import { inject, injectable } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MaybePromise } from '@theia/core/lib/common/types';
import { MessageService } from '@theia/core/lib/common/message-service';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { Sketch, SketchesService } from '../../common/protocol';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { ConfigService } from './config-service';

// As currently implemented on Linux,
// the maximum number of symbolic links that will be followed while resolving a pathname is 40
const MAX_FILESYSTEM_DEPTH = 40;

@injectable()
export class SketchesServiceClientImpl {

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(SketchesService)
    protected readonly sketchesService: SketchesService;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(ConfigService)
    protected readonly configService: ConfigService;

    async currentSketch(url: URL = new URL(window.location.href)): Promise<Sketch | undefined> {
        let sketchUri: string | undefined = url.searchParams.get('sketchUri') || undefined;
        if (!sketchUri) {
            sketchUri = await this.getStoredSketchUri();
        }
        if (!sketchUri) {
            return undefined;
        }
        try {
            const sketch = await this.loadSketch(new URI(sketchUri));
            return sketch;
        } catch {
            return undefined;
        }
    }

    async currentSketchFile(s: MaybePromise<Sketch | undefined> = this.currentSketch()): Promise<string | undefined> {
        const sketch = await s;
        if (sketch) {
            const uri = sketch.mainFileUri;
            const exists = await this.fileService.exists(new URI(uri));
            if (!exists) {
                this.messageService.warn(`Could not find main sketch file: ${uri} in sketch: ${sketch.name} | ${sketch.uri}`);
                return undefined;
            }
            return uri;
        }
        return undefined;
    }

    protected async getStoredSketchUri(): Promise<string | undefined> {
        const sketchUri = await this.storageService.getData<string>('current-sketch-uri');
        if (sketchUri) {
            try {
                const sketch = await this.loadSketch(new URI(sketchUri));
                const url = new URL(window.location.href);
                url.searchParams.delete('sketchUri');
                url.searchParams.set('sketchUri', sketch.uri.toString());
                window.history.pushState({}, '', url.toString());
                return sketch.uri;
            } catch (e) {
                console.log(e);
            }
        }
        return undefined;
    }

    async storeSketchUri(s: MaybePromise<Sketch>): Promise<void> {
        const sketch = await s;
        const sketchFile = await this.currentSketchFile(sketch);
        if (sketchFile) {
            return this.storageService.setData('current-sketch-uri', sketch.uri);
        }
    }

    /**
     * This is the TS implementation of `SketchLoad` from the CLI.
     * See: https://github.com/arduino/arduino-cli/issues/837
     * Based on: https://github.com/arduino/arduino-cli/blob/eef3705c4afcba4317ec38b803d9ffce5dd59a28/arduino/builder/sketch.go#L100-L215
     */
    async loadSketch(uri: URI): Promise<Sketch> {
        const exists = await this.fileService.exists(uri);
        if (!exists) {
            throw new Error(`${uri} does not exist.`);
        }
        const stat = await this.fileService.resolve(uri);
        let sketchFolder: URI | undefined;
        let mainSketchFile: URI | undefined;

        // If a sketch folder was passed, save the parent and point sketchPath to the main sketch file
        if (stat.isDirectory) {
            sketchFolder = uri;
            // Allowed extensions are .ino and .pde (but not both)
            for (const extension of Sketch.Extensions.MAIN) {
                const candidateSketchFile = uri.resolve(`${uri.path.base}${extension}`);
                const candidateExists = await this.fileService.exists(candidateSketchFile);
                if (candidateExists) {
                    if (!mainSketchFile) {
                        mainSketchFile = candidateSketchFile;
                    } else {
                        throw new Error(`Multiple main sketch files found (${mainSketchFile.path.base}, ${candidateSketchFile.path.base})`);
                    }
                }
            }

            // Check main file was found.
            if (!mainSketchFile) {
                throw new Error(`Unable to find a sketch file in directory ${sketchFolder}`);
            }

            // Check main file is readable.
            // TODO:
            // try {
            //     await fs.access(mainSketchFile, fs.constants.R_OK);
            // } catch {
            //     throw new Error('Unable to open the main sketch file.');
            // }

            const mainSketchFileStat = await this.fileService.resolve(mainSketchFile);
            if (mainSketchFileStat.isDirectory) {
                throw new Error(`Sketch must not be a directory.`);
            }
        } else {
            sketchFolder = uri.parent;
            mainSketchFile = uri;
        }

        const files: URI[] = [];
        let rootVisited = false;
        const err = await this.simpleLocalWalk(sketchFolder, MAX_FILESYSTEM_DEPTH, async (resource: URI, info: FileStat, error: Error | undefined) => {
            if (error) {
                console.log(`Error during sketch processing: ${error}`);
                return error;
            }
            const name = resource.path.base;
            if (info.isDirectory) {
                if (rootVisited) {
                    if (name.startsWith('.') || name === 'CVS' || name === 'RCS') {
                        return new SkipDir();
                    }
                } else {
                    rootVisited = true
                }
                return undefined;
            }

            if (name.startsWith('.')) {
                return undefined;
            }
            const ext = resource.path.ext;
            const isMain = Sketch.Extensions.MAIN.indexOf(ext) !== -1;
            const isAdditional = Sketch.Extensions.ADDITIONAL.indexOf(ext) !== -1;
            if (!isMain && !isAdditional) {
                return undefined;
            }

            // TODO: check if can read content.
            files.push(resource);

            return undefined;
        });

        if (err) {
            console.error(`There was an error while collecting the sketch files: ${uri}`)
            throw err;
        }

        return this.newSketch(sketchFolder, mainSketchFile, files);

    }

    private newSketch(sketchFolderResource: URI, mainFileResource: URI, allResources: URI[]): Sketch {
        let mainFile: URI | undefined;
        const uris = new Set<URI>();
        for (const resource of allResources) {
            if (resource.toString() === mainFileResource.toString()) {
                mainFile = resource;
            } else {
                uris.add(resource);
            }
        }
        if (!mainFile) {
            throw new Error('Could not locate main sketch file.');
        }
        const additionalFiles: URI[] = [];
        const otherSketchFiles: URI[] = [];
        for (const resource of Array.from(uris)) {
            const ext = resource.path.ext;
            if (Sketch.Extensions.MAIN.indexOf(ext) !== -1) {
                if (resource.path.dir.toString() === sketchFolderResource.path.toString()) {
                    otherSketchFiles.push(resource);
                }
            } else if (Sketch.Extensions.ADDITIONAL.indexOf(ext) !== -1) {
                // XXX: this is a caveat with the CLI, we do not know the `buildPath`.
                // https://github.com/arduino/arduino-cli/blob/0483882b4f370c288d5318913657bbaa0325f534/arduino/sketch/sketch.go#L108-L110
                additionalFiles.push(resource);
            } else {
                throw new Error(`Unknown sketch file extension '${ext}'.`);
            }
        }
        additionalFiles.sort();
        otherSketchFiles.sort();

        return {
            uri: sketchFolderResource.toString(),
            mainFileUri: mainFile.toString(),
            name: sketchFolderResource.path.base,
            additionalFileUris: additionalFiles.map(uri => uri.toString()),
            otherSketchFileUris: otherSketchFiles.map(uri => uri.toString())
        }
    }

    protected async simpleLocalWalk(
        rootResource: URI,
        maxDepth: number,
        walk: (resource: URI, info: FileStat | undefined, err: Error | undefined) => Promise<Error | undefined>): Promise<Error | undefined> {

        let { info, err } = await this.lstat(rootResource);
        if (err) {
            return walk(rootResource, undefined, err);
        }
        if (!info) {
            return new Error(`Could not stat file: ${rootResource}.`);
        }
        err = await walk(rootResource, info, err);
        if (err instanceof SkipDir) {
            return undefined;
        }

        if (info.isDirectory) {
            if (maxDepth <= 0) {
                return walk(rootResource, info, new Error(`Filesystem bottom is too deep (directory recursion or filesystem really deep): ${rootResource}`));
            }
            maxDepth--;
            const resources: URI[] = [];
            try {
                resources.push(...(info.children || []).map(stat => stat.resource));
            } catch { }
            for (const resource of resources) {
                err = await this.simpleLocalWalk(resource, maxDepth, walk);
                if (err instanceof SkipDir) {
                    return undefined;
                }
            }
        }

        return undefined;
    }

    private async lstat(resource: URI): Promise<{ info: FileStat, err: undefined } | { info: undefined, err: Error }> {
        let exists = await this.fileService.exists(resource);
        if (!exists) {
            exists = await this.fileService.exists(resource);
            return { info: undefined, err: new Error(`${resource} does not exist`) };
        }
        try {
            const info = await this.fileService.resolve(resource);
            return { info, err: undefined };
        } catch (err) {
            return { info: undefined, err };
        }
    }

    async isSketchFolder(uri: URI): Promise<boolean> {
        const exists = await this.fileService.exists(uri);
        if (!exists) {
            return false;
        }
        const stat = await this.fileService.resolve(uri);
        if (stat.isDirectory) {
            const children = (stat.children || []).map(stat => stat.resource);
            for (let i = 0; i < children.length; i++) {
                if (children[i].path.base === uri.path.base + '.ino') {
                    try {
                        await this.loadSketch(uri);
                        return true;
                    } catch { }
                }
            }
        }
        return false;
    }

    async getSketchFolder(uri: URI): Promise<Sketch | undefined> {
        let currentUri = uri
        while (currentUri && !currentUri.path.isRoot) {
            if (await this.isSketchFolder(currentUri)) {
                return this.loadSketch(currentUri);
            }
            currentUri = currentUri.parent;
        }
        return undefined;
    }

    protected async getSketchbookUri(): Promise<URI> {
        const { sketchDirUri } = await this.configService.getConfiguration();
        return new URI(sketchDirUri);
    }

    async getSketches(uri: MaybePromise<URI> = this.getSketchbookUri()): Promise<Sketch[]> {
        const sketches: Array<Sketch & { mtime: number }> = [];
        const resource = await uri;
        const exists = this.fileService.exists(resource);
        if (!exists) {
            return [];
        }

        const stat = await this.fileService.resolve(resource);
        if (stat.isFile) {
            return []; // TODO: throw?
        }

        const children = (stat.children || []).map(s => s.resource);
        for (const child of children) {
            if (await this.isSketchFolder(child)) {
                try {
                    const [childStat, sketch] = await Promise.all([
                        this.fileService.resolve(child),
                        this.loadSketch(child)
                    ]);
                    sketches.push({
                        ...sketch,
                        mtime: childStat.mtime || 0
                    });
                } catch (e) {
                    console.warn(`Could not load sketch from ${child.toString()}. Skipping it.`);
                }
            }
        }

        return sketches.sort((left, right) => right.mtime - left.mtime);
    }

}

class SkipDir extends Error {
    constructor() {
        super('skip this directory');
        Object.setPrototypeOf(this, SkipDir.prototype);
    }
}

import { injectable, inject, postConstruct } from "inversify";
import URI from '@theia/core/lib/common/uri';
import { ArduinoCreateAPI } from './create-api/arduino-create-api';
import { ConfigService } from 'arduino-ide-extension/lib/common/protocol/config-service';
import { FileSystem, FileStat } from "@theia/filesystem/lib/common";
import { AuthService } from "./auth/auth-service";
import { FileSystemWatcher } from "@theia/filesystem/lib/browser";
import { Path, MenuModelRegistry, MessageService } from "@theia/core";
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { ArduinoCreateConflictDialog } from "./arduino-create-conflict-dialog";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { EditorManager } from "@theia/editor/lib/browser";
import { ArduinoCreateDeleteDialog } from "./arduino-create-delete-dialog";

export const ARDUINO_CREATE_SKETCH_MARKER_FILE = '.arduino_create';

export interface ArduinoCreateSketchData {
    sketch: ArduinoCreateSketch;
    files: ArduinoCreateFile[];
}

export interface ArduinoCreateFile {
    name: string;
    path: string;
    modified_at: string;
}

export interface ArduinoCreateSketch {
    name: string;
    id: string;
    path: string;
    modified_at: string;
}

export namespace ArduinoCreateSketch {
    export function is(sketch: any): sketch is ArduinoCreateSketch {
        return 'path' in sketch && 'modified_at' in sketch && 'id' in sketch;
    }
}

export interface ArduinoCreateConflictResponse {
    code: string;
    detail: string;
    status: number | string;
}

export namespace ArduinoCreateConflictResponse {
    export function is(obj: any): obj is ArduinoCreateConflictResponse {
        return 'code' in obj && 'detail' in obj && 'status' in obj;
    }
}

export interface ArduinoCreateUploadSketch {
    user_id: string;
    path: string;
    ino: string; // the data of the sketch ino file
}

export interface ArduinoCreateUploadFile {
    name: string,
    data: string
}

@injectable()
export class ArduinoCreateService {

    @inject(ConfigService) protected config: ConfigService;
    @inject(ArduinoCreateAPI) protected api: ArduinoCreateAPI;
    @inject(FileSystem) protected fileSystem: FileSystem;
    @inject(AuthService) protected authService: AuthService;
    @inject(FileSystemWatcher) protected fileSystemWatcher: FileSystemWatcher;
    @inject(WorkspaceService) protected workspaceService: WorkspaceService;
    @inject(MenuModelRegistry) protected menuRegistry: MenuModelRegistry;
    @inject(MessageService) protected messageService: MessageService;
    @inject(EditorManager) protected editorManager: EditorManager;

    protected sketchbookURI: URI;

    @postConstruct()
    protected async init() {
        const config = await this.config.getConfiguration();
        this.sketchbookURI = new URI(config.sketchDirUri).withScheme('file');
        this.fileSystemWatcher.onFilesChanged(changes => {
            if (this.authService.isAuthorized) {
                const ws = this.workspaceService.workspace;
                if (ws && !(changes.length === 1 && changes[0].uri.displayName === ARDUINO_CREATE_SKETCH_MARKER_FILE)) {
                    this.sync(ws.resource.toString());
                }
            }
        });
        this.workspaceService.onWorkspaceChanged(async fileStats => {
            if (this.authService.isAuthorized) {
                await Promise.all(fileStats.map(async sketchFileStat => {
                    this.sync(sketchFileStat.resource.toString());
                }));
            }
        })
    }

    async sync(uri: string) {
        const sketchUri = new URI(uri);
        if (sketchUri.path.toString() === this.sketchbookURI.path.toString()) {
            await this.syncAllOpenSketches();
        } else {
            await this.syncSketch(sketchUri);
        }
    }

    protected async syncAllOpenSketches(): Promise<void> {
        const editors = this.editorManager.all;
        await Promise.all(editors.map(async e => {
            if (e.isVisible) {
                const uri = e.getResourceUri();
                if (uri) {
                    const isPartOfSketch = this.fileSystem.exists(uri.path.dir.join(uri.path.dir.name + '.ino').toString());
                    if (isPartOfSketch) {
                        await this.syncSketch(uri.parent)
                    }
                }
            }
        }));
    }

    async getCreateSketches(): Promise<ArduinoCreateSketch[]> {
        const sketches = await this.api.getSketches();
        return sketches;
    }

    async downloadSketch(sketch: ArduinoCreateSketch): Promise<URI> {
        const sketchDirUri = this.sketchbookURI.withPath(this.sketchbookURI.path.join(sketch.name));
        if (!(await this.fileSystem.exists(sketchDirUri.toString()))) {
            await this.fileSystem.createFolder(sketchDirUri.toString());
        }
        const markerFile = sketchDirUri.withPath(sketchDirUri.path.join(ARDUINO_CREATE_SKETCH_MARKER_FILE));
        if (!(await this.fileSystem.exists(markerFile.toString()))) {
            await this.fileSystem.createFile(markerFile.toString());
        }
        return sketchDirUri;
    }


    protected getMarkerFile(sketchURI: URI): URI {
        return sketchURI.withPath(sketchURI.path.join(ARDUINO_CREATE_SKETCH_MARKER_FILE));
    }

    protected async isValidSketch(sketchURI: URI): Promise<boolean> {
        if (!await this.fileSystem.exists(sketchURI.toString())) {
            return false;
        }
        const inoFile = sketchURI.withPath(sketchURI.path.join(sketchURI.displayName + '.ino'));
        if (!await this.fileSystem.exists(inoFile.toString())) {
            return false;
        }
        return true;
    }

    async addCreateSketch(): Promise<void> {
        const roots = await this.workspaceService.roots;
        for (const root of roots) {
            const sketchURI = root.resource;
            if (!await this.isValidSketch(sketchURI)) {
                throw new Error("The Workspace has to be a valid Arduino Sketch");
            }
            const markerPath = sketchURI.withPath(sketchURI.path.join(ARDUINO_CREATE_SKETCH_MARKER_FILE)).toString();
            if (!(await this.fileSystem.exists(markerPath))) {
                try {
                    await this.internalAddCreateSketch(sketchURI);
                    this.messageService.info(`Uploaded ${sketchURI.displayName} to your Arduino Create Account.`);
                } catch (err) {
                    this.messageService.error(`Couldn't upload ${sketchURI.displayName} to your Arduino Create Account.\n Error was: ${err.getMessage ? err.getMessage() : err}`);
                }
            } else {
                this.sync(sketchURI.toString());
            }
        }
    }

    protected async internalAddCreateSketch(sketchURI: URI): Promise<void> {
        const uploadFiles: ArduinoCreateUploadFile[] = [];
        let ino: string = '';
        const wsStat = await this.fileSystem.getFileStat(sketchURI.toString());
        if (wsStat && wsStat.children) {
            await Promise.all(wsStat.children.map(async file => {
                if (!file.isDirectory) {
                    const fileUri = new URI(file.uri);
                    const stat = await this.fileSystem.resolveContent(file.uri);
                    if (!fileUri.displayName.startsWith('.') && fileUri.path.ext !== '.elf' && fileUri.path.ext !== '.hex') {
                        if (fileUri.displayName !== sketchURI.displayName + '.ino') {
                            const fileName = fileUri.displayName;
                            uploadFiles.push({
                                name: fileName,
                                data: this.tryEncode(stat.content)
                            })
                        } else {
                            ino = this.tryEncode(stat.content);
                        }
                    }
                }
            }));
        }
        const sketchUploadData: ArduinoCreateUploadSketch = {
            user_id: 'me', ino, path: sketchURI.displayName
        }
        const sketch = await this.api.addCreateSketch(sketchUploadData, uploadFiles);
        if (ArduinoCreateSketch.is(sketch)) {
            const files = await this.api.listFiles(sketch.path);
            const sketchData: ArduinoCreateSketchData = {
                sketch, files
            }
            await this.createOrUpdateMarkerFile(sketchURI, sketchData);
        } else if (ArduinoCreateConflictResponse.is(sketch)) {
            this.messageService.error(sketch.detail);
        }
    }

    private currentSync = Promise.resolve();

    async syncSketch(sketchUri: URI): Promise<void> {
        const current = this.currentSync;
        const newSync = new Deferred<void>();
        this.currentSync = newSync.promise;
        await current;
        try {
            await this.internalSyncSketch(sketchUri);
        } catch (err) {
            console.error(err);
        }
        newSync.resolve();
        return this.currentSync;
    }

    protected async internalSyncSketch(sketchUri: URI): Promise<void> {
        const markerPath = sketchUri.withPath(sketchUri.path.join(ARDUINO_CREATE_SKETCH_MARKER_FILE)).toString();
        if (await this.fileSystem.exists(markerPath)) {
            const markerContent = await this.fileSystem.resolveContent(markerPath);
            let localSketchData: ArduinoCreateSketchData | undefined;
            // an empty .arduino_create means never synced. So we will initialize from remote
            if (!markerContent.content || markerContent.content.trim().length === 0) {
                const sketch = (await this.api.getSketches()).find(s => s.name === sketchUri.displayName);
                if (sketch) {
                    localSketchData = {
                        sketch: JSON.parse(JSON.stringify(sketch)),
                        files: []
                    };
                    // make sure everything gets synchronized
                    localSketchData.sketch.modified_at = '';
                }
            } else {
                localSketchData = JSON.parse(markerContent.content) as ArduinoCreateSketchData;
            }

            if (!localSketchData) {
                throw new Error(`No sketch data found for ${sketchUri.toString()}.`);
            }

            const newSketch = await this.api.getSketchByPath(localSketchData.sketch.path);
            if ((ArduinoCreateConflictResponse.is(newSketch) && newSketch.status === 404)) {
                await this.resolveRemoteDeletion(sketchUri, markerPath);
            } else {
                if (newSketch.name !== localSketchData.sketch.name) {
                    localSketchData.sketch = newSketch;
                    const newURI = sketchUri.parent.resolve(newSketch.name);
                    await this.fileSystem.move(sketchUri.toString(), newURI.toString());
                    sketchUri = newURI;
                }

                await this.synchronizeSketch(sketchUri, localSketchData, newSketch, markerContent.stat);

                const remoteFiles = await this.api.listFiles(newSketch.path);
                localSketchData.sketch = newSketch;
                localSketchData.files = remoteFiles;

                await this.createOrUpdateMarkerFile(sketchUri, localSketchData);
            }

        }
    }

    protected async synchronizeSketch(sketchUri: URI, localSketchData: ArduinoCreateSketchData, newSketch: ArduinoCreateSketch, markerFileStat: FileStat): Promise<void> {
        const localSketch = localSketchData.sketch;
        const lastSync = markerFileStat.lastModification;
        const remoteFiles = await this.api.listFiles(localSketch.path);
        const sketchDirStat = await this.fileSystem.getFileStat(sketchUri.toString());
        const localSketchFileStats = sketchDirStat && sketchDirStat.children ? sketchDirStat.children : [];
        const allSketches = new Map<string, { remote?: ArduinoCreateFile, local?: FileStat, lastRemote?: ArduinoCreateFile }>();
        remoteFiles.forEach(rf => allSketches.set(rf.name, { remote: rf }));
        localSketchData.files.forEach(rf => {
            if (allSketches.has(rf.name)) {
                allSketches.get(rf.name)!.lastRemote = rf;
            } else {
                allSketches.set(rf.name, { lastRemote: rf });
            }
        });
        localSketchFileStats.forEach(lf => {
            const uri = new URI(lf.uri);
            if (uri.path.ext !== '.elf' && uri.path.ext !== '.hex') {
                if (allSketches.has(uri.displayName)) {
                    allSketches.get(uri.displayName)!.local = lf;
                } else {
                    allSketches.set(uri.displayName, { local: lf });
                }
            }
        });
        allSketches.delete(ARDUINO_CREATE_SKETCH_MARKER_FILE);

        for (const name of allSketches.keys()) {
            const { remote, local, lastRemote } = allSketches.get(name)!;
            await this.syncSketchFile({ name, sketchUri, lastSync, localSketchData, newSketch, remote, local, lastRemote });
        }
    }

    protected async syncSketchFile(ctx: FileSyncContext): Promise<void> {
        // both exists one potentially needs update
        if (ctx.remote && ctx.local) {
            const remoteChanged = !ctx.lastRemote || ctx.lastRemote.modified_at < ctx.remote.modified_at;
            const localChanged = ctx.lastSync < ctx.local.lastModification;

            if (remoteChanged && localChanged) {
                console.log('conflict ' + ctx.name);
                await this.resolveConflict(ctx);
            } else if (remoteChanged) {
                console.log('update local ' + ctx.name);
                await this.updateLocally(ctx);
            } else if (localChanged) {
                console.log('update remote ' + ctx.name);
                await this.updateRemotely(ctx);
            }
        } else if (ctx.remote) {
            const remoteAdded = !ctx.lastRemote;
            if (remoteAdded) {
                await this.addLocally(ctx);
            } else {
                await this.deleteRemotely(ctx);
            }
        } else if (ctx.local) {
            const localAdded = !ctx.lastRemote;
            if (localAdded) {
                await this.addRemotely(ctx);
            } else {
                await this.deleteLocally(ctx);
            }
        }
    }

    protected async addRemotely(ctx: FileSyncContext): Promise<void> {
        let { content } = await this.fileSystem.resolveContent(ctx.local!.uri);
        const path = new Path(ctx.localSketchData.sketch.path).join(ctx.name).toString();
        await this.api.writeFile(path, this.tryEncode(content));
    }

    protected async updateRemotely(ctx: FileSyncContext): Promise<void> {
        const { content } = await this.fileSystem.resolveContent(ctx.local!.uri);
        const remoteContent = await this.api.readFile(ctx.remote!.path);
        if (content !== this.tryDecode(remoteContent)) {
            await this.api.writeFile(ctx.remote!.path, this.tryEncode(content));
        }
    }

    protected async deleteRemotely(ctx: FileSyncContext): Promise<void> {
        await this.api.deleteFile(ctx.remote!.path)
    }

    protected async addLocally(ctx: FileSyncContext): Promise<void> {
        const content = await this.api.readFile(ctx.remote!.path);
        await this.fileSystem.createFile(ctx.sketchUri.withPath(ctx.sketchUri.path.join(ctx.name)).toString(), {
            content: this.tryDecode(content)
        })
    }

    protected async updateLocally(ctx: FileSyncContext): Promise<void> {
        const remoteContent = this.tryDecode(await this.api.readFile(ctx.remote!.path));
        const { content } = await this.fileSystem.resolveContent(ctx.local!.uri);
        if (remoteContent !== content) {
            await this.fileSystem.setContent(ctx.local!, remoteContent);
        }
    }

    protected async deleteLocally(ctx: FileSyncContext): Promise<void> {
        await this.fileSystem.delete(ctx.local!.uri);
    }

    protected async resolveConflict(ctx: FileSyncContext): Promise<void> {
        const fileLocation = await new ArduinoCreateConflictDialog(ctx.localSketchData.sketch.name, ctx.name).open();
        if (fileLocation === 'remote') {
            await this.updateLocally(ctx);
        } else {
            await this.updateRemotely(ctx);
        }
    }

    protected async resolveRemoteDeletion(sketchURI: URI, markerPath: string): Promise<void> {
        const action = await new ArduinoCreateDeleteDialog(sketchURI.displayName).open();
        if (action === 'delete') {
            await this.fileSystem.delete(sketchURI.toString());
            await this.workspaceService.close();
        } else {
            await this.fileSystem.delete(markerPath);
        }
    }

    protected tryEncode(content: string): string {
        try {
            return btoa(content);
        } catch (err) {
            console.error(err, content);
            return content;
        }
    }

    protected tryDecode(content: string): string {
        try {
            return atob(content);
        } catch (err) {
            console.error(err, content);
            return content;
        }
    }

    protected async createOrUpdateMarkerFile(sketchUri: URI, sketchData: ArduinoCreateSketchData): Promise<void> {
        const arduinoCreateMarkerFile = sketchUri.withPath(sketchUri.path.join(ARDUINO_CREATE_SKETCH_MARKER_FILE)).toString();
        const markerFileExists = await this.fileSystem.exists(arduinoCreateMarkerFile);
        if (!markerFileExists) {
            await this.fileSystem.createFile(arduinoCreateMarkerFile, { content: JSON.stringify(sketchData) });
        } else {
            const markerFileStat = await this.fileSystem.getFileStat(arduinoCreateMarkerFile);
            if (markerFileStat) {
                await this.fileSystem.setContent(markerFileStat, JSON.stringify(sketchData));
            }
        }
    }

}

interface FileSyncContext {
    name: string, sketchUri: URI, lastSync: number, localSketchData: ArduinoCreateSketchData,
    newSketch: ArduinoCreateSketch,
    remote?: ArduinoCreateFile, local?: FileStat
    lastRemote?: ArduinoCreateFile
}

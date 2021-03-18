import URI from '@theia/core/lib/common/uri';

export namespace CreateUri {

    export const SCHEME = 'create';

    export function is(uri: string | URI): boolean {
        if (uri instanceof URI) {
            return uri.scheme === SCHEME;
        }
        return is(new URI(uri));
    }

    export function create(path: string): URI {
        if (!path) {
            throw new Error("'path' must be defined.");
        }
        if (!path.trim().length) {
            throw new Error("'path' must contain at least one non-whitespace character.");
        }
        return new URI(encodeURIComponent(path)).withScheme(SCHEME);
    }

    export function path(uri: string | URI): string {
        if (!is(uri)) {
            throw new Error(`Expected '${CreateUri.SCHEME}' URI scheme. Got: ${uri} instead.`);
        }
        return (uri instanceof URI ? uri : new URI(uri)).toString(true).slice(`${CreateUri.SCHEME}:/`.length);
    }

    /**
     * Returns the URI of the sketch that contains the resource by the URI.
     */
    export function sketchUri(uri: string | URI): URI {
        if (!is(uri)) {
            throw new Error(`Expected '${CreateUri.SCHEME}' URI scheme. Got: ${uri} instead.`);
        }
        // TODO: do it better. the URI has the following format: `uuid{32}:username/api_version/sketch_name/path/to/file`.
        const [id, segments] = path(uri).split(':') || [];
        if (!id || !segments) {
            throw new Error(`Could not extract sketch URI from ${uri}. id: ${id}, segments: ${segments}`);
        }
        const [username, apiVersion, sketchName] = segments.split('/');
        if (!username || !apiVersion || !sketchName) {
            throw new Error(`Could not extract sketch URI from ${uri}. username: ${username} apiVersion: ${apiVersion}, sketchName: ${sketchName}`);
        }
        return create(`${id}:${username}/${apiVersion}/${sketchName}`);
    }

    export function parentUri(uri: string | URI): URI {
        if (!is(uri)) {
            throw new Error(`Expected '${CreateUri.SCHEME}' URI scheme. Got: ${uri} instead.`);
        }
        const [id, segments] = path(uri).split(':') || [];
        if (!id || !segments) {
            throw new Error(`Could not extract sketch URI from ${uri}. id: ${id}, segments: ${segments}`);
        }
        return create(`${id}:${segments.split('/').slice(0, segments.split('/').length - 1)}`);
    }

}

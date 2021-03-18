import { injectable, inject } from 'inversify';
import { Event, Emitter } from '@theia/core/lib/common/event';

export interface Token {
    access_token: string;
    refresh_token: string;
    scope: 'offline_access' | string;
    /**
     * expires in seconds
     */
    expires_in: number;
    token_type: 'Bearer' | string;
}
export namespace Token {
    export function is(thing: any): thing is Token {
        return (typeof thing === 'object') && 'access_token' in thing;
    }
}

export class AuthError extends Error {
    constructor(public readonly code: number, message?: string) {
        super(message);
    }
}

export class NotAuthorized extends AuthError {
    constructor(message?: string) {
        super(401, message);
    }
}

@injectable()
export class TokenStore {

    getToken(): Token | undefined {
        const tokenStr = localStorage.getItem('arduino_create_token');
        if (tokenStr) {
            const token = JSON.parse(tokenStr);
            if (Token.is(token)) {
                return token;
            }
        }
    }

    deleteToken(): void {
        localStorage.removeItem('arduino_create_token');
    }

    protected updatedAt: number;
    setToken(fresh: Token) {
        this.updatedAt = Date.now() / 1000 - 60;
        localStorage.setItem('arduino_create_token', JSON.stringify(fresh));
        localStorage.setItem('arduino_create_token_updated_at', JSON.stringify(this.updatedAt));
    }

    get expired(): boolean {
        const token = this.getToken();
        const updatedAt = localStorage.getItem('arduino_create_token_updated_at');
        return !token || !updatedAt || (parseInt(updatedAt, 10) + token.expires_in <= Date.now() / 1000);
    }

}


@injectable()
export class AuthService {

    @inject(TokenStore)
    protected store: TokenStore;

    protected readonly onAuthorizedEmitter = new Emitter<void>();

    get isAuthorized(): boolean {
        return !this.store.expired;
    }

    getToken(): Promise<Token> {
        throw new NotAuthorized();
    }

    authorize(): Promise<Token> {
        return this.getToken();
    }

    get onAuthorized(): Event<void> {
        return this.onAuthorizedEmitter.event;
    }

    protected fireAuthorized(): void {
        this.onAuthorizedEmitter.fire();
    }

}

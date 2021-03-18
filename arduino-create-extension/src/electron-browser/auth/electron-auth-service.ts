import { injectable } from "inversify";
import { AuthService, Token } from "../../browser/auth/auth-service";
import { Authentication, AuthOptions } from "auth0-js";
import { Random } from "@phosphor/coreutils/lib/random";
import { sha256 } from "hash.js";
import { remote } from 'electron';
import { Deferred } from "@theia/core/lib/common/promise-util";

interface AuthOptions2 extends AuthOptions {
    code_challenge_method: string;
    code_challenge: string;
}

@injectable()
export class ElectronAuthService extends AuthService {

    protected pkp = this.generateProofKeyPair();

    protected authOptions: AuthOptions2 = {
        clientID: "C34Ya6ex77jTNxyKWj01lCe1vAHIaPIo",
        domain: "login.arduino.cc",
        audience: "https://api.arduino.cc",
        redirectUri: "http://localhost:9876/callback",
        scope: "profile offline_access",
        responseType: "code",
        code_challenge_method: "S256",
        code_challenge: this.pkp.challenge
    }

    async getToken(): Promise<Token> {
        const token = this.store.getToken();
        if (token) {
            if (!this.store.expired) {
                this.fireAuthorized();
                return token;
            } else {
                if (token.refresh_token) {
                    const newToken = await this.refreshToken(token);
                    this.store.setToken(newToken);
                    this.fireAuthorized();
                    return newToken;
                } else {
                    return await this.getTokenFromLogin();
                }
            }
        } else {
            return await this.getTokenFromLogin();
        }
    }

    async login(): Promise<Token> {
        const authCode = await this.doLoginAndGetAuthCode();
        const token = await this.exchangeForToken(authCode);
        return token;
    }

    async exchangeForToken(authCode: string): Promise<Token> {
        const response = await fetch(`https://${this.authOptions.domain}/oauth/token`, {
            method: "POST",
            body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: this.authOptions.clientID,
                code_verifier: this.pkp.verifier,
                code: authCode,
                redirect_uri: this.authOptions.redirectUri
            }),
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });
        if (response.ok) {
            const result = await response.json();
            return result;
        }
        throw new Error(`Failed to fetch a token: ${response.statusText}`);
    }

    async refreshToken(oldToken: Token): Promise<Token> {
        const response = await fetch(`https://${this.authOptions.domain}/oauth/token`, {
            method: "POST",
            body: JSON.stringify({
                grant_type: "refresh_token",
                client_id: this.authOptions.clientID,
                refresh_token: oldToken.refresh_token,
            }),
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });
        if (response.ok) {
            const result = await response.json();
            return result;
        }
        throw new Error(`Failed to refresh a token: ${response.statusText}`);
    }

    async doLoginAndGetAuthCode() {
        const result = new Deferred<string>();

        const auth0 = new Authentication(this.authOptions);
        const authorizeUrl = auth0.buildAuthorizeUrl({});

        const authWindow = new remote.BrowserWindow({
            width: 800,
            height: 600,
            title: "Log in",
            backgroundColor: "#202020"
        });

        const contextMenuListener = (_: Electron.Event, params: Electron.ContextMenuParams) => {
            const { selectionText, isEditable } = params;
            const selectionMenu = remote.Menu.buildFromTemplate([
                { role: 'copy' },
                { type: 'separator' },
                { role: 'selectAll' },
            ]);

            const inputMenu = remote.Menu.buildFromTemplate([
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { type: 'separator' },
                { role: 'selectAll' },
            ]);
            if (isEditable) {
                inputMenu.popup();
            } else if (selectionText && selectionText.trim() !== '') {
                selectionMenu.popup();
            }
        };
        authWindow.webContents.on('dom-ready', () => {
            authWindow.webContents.on('context-menu', contextMenuListener);
        });

        authWindow.webContents.on("did-navigate" as any, (event: any, href: string) => {
            const location = new URL(href);
            if (location.toString().startsWith(this.authOptions.redirectUri!)) {
                result.resolve(location.searchParams.get("code") || "missing-code");
                authWindow.destroy();
            }
        });

        authWindow.on("close", () => {
            authWindow.webContents.removeListener('context-menu', contextMenuListener);
            result.reject();
        });

        authWindow.loadURL(authorizeUrl);
        return result.promise;
    }

    protected async getTokenFromLogin(): Promise<Token> {
        const token = await this.login();
        this.store.setToken(token);
        this.fireAuthorized();
        return token;
    }

    protected generateProofKeyPair() {
        const urlEncode = (str: string) => str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        const decode = (buffer: Uint8Array | number[]) => {
            let decodedString = "";
            for (let i = 0; i < buffer.length; i++) {
                decodedString += String.fromCharCode(buffer[i]);
            }
            return decodedString;
        };
        const buffer = new Uint8Array(32);
        Random.getRandomValues(buffer);
        const seed = btoa(decode(buffer));

        const verifier = urlEncode(seed);
        const challenge = urlEncode(btoa(decode(sha256().update(verifier).digest())));
        return { verifier, challenge };
    }
}

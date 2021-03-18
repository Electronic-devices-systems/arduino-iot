import { inject, injectable, postConstruct } from 'inversify';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
// import { CommonCommands } from '@theia/core/lib/browser/common-frontend-contribution';
// import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
// import { PreferenceService } from '@theia/core/lib/browser/preferences/preference-service';
// import { MonacoEditorService } from '@theia/monaco/lib/browser/monaco-editor-service';
// import { EDITOR_FONT_DEFAULTS } from '@theia/editor/lib/browser/editor-preferences';
import { CommandRegistry, Contribution, MenuModelRegistry, Command } from 'arduino-ide-extension/lib/browser/contributions/contribution';
import { ArduinoCreateMenus } from '../menus/arduino-create-menus';
import { AuthService } from '../auth/auth-service';
// import { ArduinoMenus } from 'arduino-ide-extension/lib/browser/menu/arduino-menus';

@injectable()
export class SignIn extends Contribution {

    @inject(AuthService)
    protected readonly authService: AuthService;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    protected readonly toDisposeOnLoginStateChange = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.authService.onAuthorized(() => {

        });
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(SignIn.Commands.SIGN_IN, {
            execute: () => this.authService.authorize(),
            isEnabled: () => !this.authService.isAuthorized,
            isVisible: () => !this.authService.isAuthorized
        });
        registry.registerCommand(SignIn.Commands.SIGN_UP, {
            execute: () => this.windowService.openNewWindow('https://auth.arduino.cc/login#/register', { external: true }),
            isEnabled: () => !this.authService.isAuthorized,
            isVisible: () => !this.authService.isAuthorized
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(ArduinoCreateMenus.CREATE__LOGIN_GROUP, {
            commandId: SignIn.Commands.SIGN_IN.id,
            label: 'Sign In',
            order: '0'
        });
        registry.registerMenuAction(ArduinoCreateMenus.CREATE__LOGIN_GROUP, {
            commandId: SignIn.Commands.SIGN_UP.id,
            label: 'Sign Up',
            order: '1'
        });
    }

}

export namespace SignIn {
    export namespace Commands {
        export const SIGN_IN: Command = {
            id: 'arduino-create-sign-in'
        };
        export const SIGN_UP: Command = {
            id: 'arduino-create-sign-up'
        };
    }
}

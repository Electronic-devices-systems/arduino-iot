import { ArduinoCreateExtensionFrontendContribution } from './arduino-create-extension-contribution';
import { CommandContribution, MenuContribution } from "@theia/core/lib/common";
import { ContainerModule } from "inversify";
import { ArduinoCreateService } from './arduino-create-service';
import { ArduinoCreateAPI } from './create-api/arduino-create-api';
import { AuthService, TokenStore } from './auth/auth-service';
import { ArduinoCreateSketchManager } from './arduino-create-sketch-manager';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Contribution } from 'arduino-ide-extension/lib/browser/contributions/contribution';
import { SignIn } from './contributions/signin';
import { CreateSketchbookWidget } from './sketchbbook/create-sketchbook-widget';
import { SketchbookWidget } from 'arduino-ide-extension/lib/browser/sketchbook/sketchbook-widget';
import { FileServiceContribution } from '@theia/filesystem/lib/browser/file-service';

export default new ContainerModule((bind, unbind, isBound, rebind) => {

    bind(ArduinoCreateExtensionFrontendContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(ArduinoCreateExtensionFrontendContribution);
    bind(MenuContribution).toService(ArduinoCreateExtensionFrontendContribution);
    bind(FrontendApplicationContribution).toService(ArduinoCreateExtensionFrontendContribution);

    bind(ArduinoCreateService).toSelf().inSingletonScope();
    bind(ArduinoCreateAPI).toSelf().inSingletonScope();

    bind(AuthService).toSelf().inSingletonScope();
    bind(TokenStore).toSelf().inSingletonScope();

    bind(ArduinoCreateSketchManager).toSelf().inSingletonScope();

    bind(CreateSketchbookWidget).toSelf();
    rebind(SketchbookWidget).to(CreateSketchbookWidget);
    Contribution.configure(bind, SignIn);

    bind(FileServiceContribution).toService(ArduinoCreateAPI);
});

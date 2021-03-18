import { ContainerModule } from "inversify";
import { AuthService } from "../browser/auth/auth-service";
import { ElectronAuthService } from "./auth/electron-auth-service";

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(AuthService).to(ElectronAuthService).inSingletonScope();
})
import { inject, injectable } from 'inversify';
import { OutputChannelManager } from '@theia/output/lib/common/output-channel';
import { CoreService } from '../../common/protocol';
import { ArduinoMenus } from '../menu/arduino-menus';
import { BoardsDataStore } from '../boards/boards-data-store';
import { MonitorConnection } from '../monitor/monitor-connection';
import { BoardsServiceProvider } from '../boards/boards-service-provider';
import { SketchContribution, Command, CommandRegistry, MenuModelRegistry } from './contribution';

@injectable()
export class BurnBootloader extends SketchContribution {

    @inject(CoreService)
    protected readonly coreService: CoreService;

    @inject(MonitorConnection)
    protected readonly monitorConnection: MonitorConnection;

    @inject(BoardsDataStore)
    protected readonly boardsDataStore: BoardsDataStore;

    @inject(BoardsServiceProvider)
    protected readonly boardsServiceClientImpl: BoardsServiceProvider;

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(BurnBootloader.Commands.BURN_BOOTLOADER, {
            execute: () => this.burnBootloader()
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(ArduinoMenus.TOOLS__BOARD_SETTINGS_GROUP, {
            commandId: BurnBootloader.Commands.BURN_BOOTLOADER.id,
            label: 'Burn Bootloader',
            order: 'z99'
        });
    }

    async burnBootloader(): Promise<void> {
        const monitorConfig = this.monitorConnection.monitorConfig;
        if (monitorConfig) {
            await this.monitorConnection.disconnect();
        }
        try {
            const { boardsConfig } = this.boardsServiceClientImpl;
            const port = boardsConfig.selectedPort?.address;
            const [fqbn, { selectedProgrammer: programmer }, verify, verbose] = await Promise.all([
                this.boardsDataStore.appendConfigToFqbn(boardsConfig.selectedBoard?.fqbn),
                this.boardsDataStore.getData(boardsConfig.selectedBoard?.fqbn),
                this.preferences.get('arduino.upload.verify'),
                this.preferences.get('arduino.upload.verbose')
            ]);
            this.outputChannelManager.getChannel('Arduino').clear();
            await this.coreService.burnBootloader({
                fqbn,
                programmer,
                port,
                verify,
                verbose
            });
            this.messageService.info('Done burning bootloader.', { timeout: 1000 });
        } catch (e) {
            this.messageService.error(e.toString());
        } finally {
            if (monitorConfig) {
                await this.monitorConnection.connect(monitorConfig);
            }
        }
    }

}

export namespace BurnBootloader {
    export namespace Commands {
        export const BURN_BOOTLOADER: Command = {
            id: 'arduino-burn-bootloader'
        };
    }
}

import { injectable, inject } from 'inversify';
import { HostedPluginReader } from '@theia/plugin-ext/lib/hosted/node/plugin-reader';
import { PluginPackage, PluginContribution } from '@theia/plugin-ext/lib/common/plugin-protocol';
import { CLI_CONFIG } from './cli-config';
import { ConfigServiceImpl } from './config-service-impl';

@injectable()
export class ArduinoHostedPluginReader extends HostedPluginReader {

    @inject(ConfigServiceImpl)
    protected readonly configService: ConfigServiceImpl;
    protected cliConfigSchemaUri: string;

    async onStart(): Promise<void> {
        return new Promise<void>(resolve => {
            this.configService.getConfigurationFileSchemaUri().then(uri => {
                this.cliConfigSchemaUri = uri;
                resolve();
            });
        });
    }

    readContribution(plugin: PluginPackage): PluginContribution | undefined {
        const scanner = this.scanner.getScanner(plugin);
        const contribution = scanner.getContribution(plugin);
        if (plugin.name === 'vscode-yaml' && contribution && contribution.configuration) {
            const { configuration } = contribution;
            for (const config of configuration) {
                if (typeof config.properties['yaml.schemas'] === 'undefined') {
                    config.properties['yaml.schemas'] = {};
                }
                config.properties['yaml.schemas'].default = {
                    [this.cliConfigSchemaUri]: [CLI_CONFIG]
                };
            }
        }
        return contribution;
    }

}

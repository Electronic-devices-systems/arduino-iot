import { inject, injectable } from 'inversify';
import { Emitter } from '@theia/core/lib/common/event';
import { OutputContribution } from '@theia/output/lib/browser/output-contribution';
import { OutputChannelManager } from '@theia/output/lib/common/output-channel';
import { ResponseService, OutputMessage, ProgressMessage } from '../common/protocol/response-service';

@injectable()
export class ResponseServiceImpl implements ResponseService {

    @inject(OutputContribution)
    protected outputContribution: OutputContribution;

    @inject(OutputChannelManager)
    protected outputChannelManager: OutputChannelManager;

    protected readonly progressDidChangeEmitter = new Emitter<ProgressMessage>();
    readonly onProgressDidChange = this.progressDidChangeEmitter.event;

    appendToOutput(message: OutputMessage): void {
        const { name, chunk } = message;
        const channel = this.outputChannelManager.getChannel(`Arduino: ${name}`);
        // Zen-mode: we do not reveal the output for daemon messages.
        const show: Promise<any> = name === 'daemon'
            // This will open and reveal the view but won't show it. You will see the toggle bottom panel on the status bar.
            ? this.outputContribution.openView({ activate: false, reveal: false })
            // This will open, reveal but do not activate the Output view.
            : Promise.resolve(channel.show({ preserveFocus: true }));

        show.then(() => channel.append(chunk));
    }

    reportProgress(progress: ProgressMessage): void {
        console.log("***", JSON.stringify(progress));
        this.progressDidChangeEmitter.fire(progress);
    }

}

import { AbstractDialog } from "@theia/core/lib/browser/dialogs";
import { Message } from "@phosphor/messaging";

export type ArduinoFileLocation = 'local' | 'remote';

export class ArduinoCreateConflictDialog extends AbstractDialog<ArduinoFileLocation> {
    protected localButton: HTMLButtonElement | undefined;
    protected remoteButton: HTMLButtonElement | undefined;

    protected type: ArduinoFileLocation;

    constructor(sketch: string, fileName: string) {
        super({
            title: "Arduino Create Synchronization Conflict in " + sketch
        });

        const messageNode = document.createElement('div');
        messageNode.textContent = fileName + ' contents has been changed locally and remotely. Which version do you want to use?';
        this.contentNode.appendChild(messageNode);

        this.localButton = this.appendLocalButton();
        this.remoteButton = this.appendRemoteButton();
    }

    protected appendLocalButton() {
        const localBtn = this.createButton('Local');
        this.controlPanel.appendChild(localBtn);
        return localBtn;
    }

    protected appendRemoteButton() {
        const remoteBtn = this.createButton('Remote');
        this.controlPanel.appendChild(remoteBtn);
        return remoteBtn;
    }

    onAfterAttach(msg: Message) {
        super.onAfterAttach(msg);

        if (this.localButton && this.remoteButton) {
            this.addEventListener(this.localButton, 'click', () => {
                this.type = 'local';
                this.accept();
            })
            this.addEventListener(this.remoteButton, 'click', () => {
                this.type = 'remote';
                this.accept();
            })
        }
    }

    get value(): ArduinoFileLocation {
        return this.type;
    }

}

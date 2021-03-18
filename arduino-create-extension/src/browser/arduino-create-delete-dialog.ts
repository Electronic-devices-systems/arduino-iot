import { AbstractDialog } from "@theia/core/lib/browser/dialogs";
import { Message } from "@phosphor/messaging";

export type ArduinoDeleteAction = 'keep' | 'delete';

export class ArduinoCreateDeleteDialog extends AbstractDialog<ArduinoDeleteAction> {
    protected keepButton: HTMLButtonElement | undefined;
    protected deleteButton: HTMLButtonElement | undefined;

    protected type: ArduinoDeleteAction;

    constructor(sketch: string) {
        super({
            title: "Arduino Create Sketch " + sketch + " deleted"
        });

        const messageNode = document.createElement('div');
        messageNode.textContent = sketch + ' has been deleted remotely. How do you want to proceed with the local sketch?';
        this.contentNode.appendChild(messageNode);

        this.keepButton = this.appendKeepButton();
        this.deleteButton = this.appendDeleteButton();
    }

    protected appendKeepButton() {
        const keepBtn = this.createButton('Keep it!');
        this.controlPanel.appendChild(keepBtn);
        keepBtn.classList.add('main');
        return keepBtn;
    }

    protected appendDeleteButton() {
        const deleteBtn = this.createButton('Delete');
        this.controlPanel.appendChild(deleteBtn);
        deleteBtn.classList.add('secondary');
        return deleteBtn;
    }

    onAfterAttach(msg: Message) {
        super.onAfterAttach(msg);

        if (this.keepButton && this.deleteButton) {
            this.addEventListener(this.keepButton, 'click', () => {
                this.type = 'keep';
                this.accept();
            })
            this.addEventListener(this.deleteButton, 'click', () => {
                this.type = 'delete';
                this.accept();
            })
        }
    }

    get value(): ArduinoDeleteAction {
        return this.type;
    }

}

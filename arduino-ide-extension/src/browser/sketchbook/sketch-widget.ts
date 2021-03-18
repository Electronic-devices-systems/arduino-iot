import { inject, injectable, interfaces, Container } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ContextMenuRenderer } from '@theia/core/lib/browser/context-menu-renderer';
import { open, OpenerService } from '@theia/core/lib/browser/opener-service';
import { TreeProps, TreeModel, Tree, defaultTreeProps, TreeNode } from '@theia/core/lib/browser/tree/';
import { FileTreeWidget, DirNode, FileTree, FileTreeModel, createFileTreeContainer, FileNode } from '@theia/filesystem/lib/browser';
import { Sketch } from '../../common/protocol';

export const SketchProps = Symbol('SketchProps');
export interface SketchProps {
    readonly sketch: Sketch;
}

@injectable()
export class SketchTreeModel extends FileTreeModel {

    @inject(SketchProps)
    protected readonly props: SketchProps;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    get sketch(): Sketch {
        return this.props.sketch;
    }

    protected doOpenNode(node: TreeNode): void {
        if (FileNode.is(node)) {
            open(this.openerService, node.uri);
        } else {
            super.doOpenNode(node);
        }
    }

}

@injectable()
export class SketchFileTree extends FileTree {

    // async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
    //     if (WorkspaceNode.is(parent)) {
    //         return parent.children;
    //     }
    //     return this.filter.filter(super.resolveChildren(parent));
    // }

}

export interface SketchNode extends DirNode {

}

@injectable()
export class SketchWidget extends FileTreeWidget {

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(SketchTreeModel) readonly model: SketchTreeModel,
        @inject(ContextMenuRenderer) protected contextMenuRenderer: ContextMenuRenderer,
        @inject(FileService) protected fileService: FileService
    ) {
        super(props, model, contextMenuRenderer);
        this.addClass('sketch-widget');
        this.id = `sketch-widget-${model.sketch.uri}`;
        this.title.caption = model.sketch.name;
        this.title.label = model.sketch.name

        // set the root
        this.fileService.resolve(new URI(model.sketch.uri)).then(async stat => {
            const root = Object.assign(DirNode.createRoot(stat), { visible: false });
            await this.model.navigateTo(root);
            this.update();
        });
    }

    get sketch(): Sketch {
        return this.model.sketch;
    }

}

export const SketchWidgetFactory = Symbol('SketchWidgetFactory');
export interface SketchWidgetFactory {
    (props: SketchProps): SketchWidget;
}

export function createWidgetContainer(parent: interfaces.Container, { sketch }: SketchProps): Container {
    const child = createFileTreeContainer(parent);

    child.unbind(FileTreeModel);
    child.bind(SketchTreeModel).toSelf().inSingletonScope();
    child.rebind(TreeModel).toService(SketchTreeModel);

    child.unbind(FileTreeWidget);
    child.bind(SketchWidget).toSelf();

    child.bind(SketchFileTree).toSelf();
    child.rebind(Tree).toService(SketchFileTree);

    child.rebind(TreeProps).toConstantValue({
        ...defaultTreeProps,

    });

    child.bind(SketchProps).toConstantValue({
        sketch
    });

    return child;
}


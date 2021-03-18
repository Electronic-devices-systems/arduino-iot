import { LibraryPackage } from './library-service';
import { JsonRpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { Sketch, Config, BoardsPackage, AttachedBoardsChangeEvent } from '../protocol';

export interface NotificationServiceClient {
    notifyIndexUpdated(): void;
    notifyDaemonStarted(): void;
    notifyDaemonStopped(): void;
    notifyConfigChanged(event: { config: Config | undefined }): void;
    notifyPlatformInstalled(event: { item: BoardsPackage }): void;
    notifyPlatformUninstalled(event: { item: BoardsPackage }): void;
    notifyLibraryInstalled(event: { item: LibraryPackage }): void;
    notifyLibraryUninstalled(event: { item: LibraryPackage }): void;
    notifyAttachedBoardsChanged(event: AttachedBoardsChangeEvent): void;
    notifyRecentSketchesChanged(event: { sketches: Sketch[] }): void;
}

export const NotificationServicePath = '/services/notification-service';
export const NotificationServiceServer = Symbol('NotificationServiceServer');
export interface NotificationServiceServer extends Required<NotificationServiceClient>, JsonRpcServer<NotificationServiceClient> {
    disposeClient(client: NotificationServiceClient): void;
}

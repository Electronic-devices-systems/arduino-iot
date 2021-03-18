// package: cc.arduino.cli.debug
// file: debug/debug.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as commands_common_pb from "../commands/common_pb";

export class DebugReq extends jspb.Message { 

    hasDebugreq(): boolean;
    clearDebugreq(): void;
    getDebugreq(): DebugConfigReq | undefined;
    setDebugreq(value?: DebugConfigReq): DebugReq;

    getData(): Uint8Array | string;
    getData_asU8(): Uint8Array;
    getData_asB64(): string;
    setData(value: Uint8Array | string): DebugReq;

    getSendInterrupt(): boolean;
    setSendInterrupt(value: boolean): DebugReq;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DebugReq.AsObject;
    static toObject(includeInstance: boolean, msg: DebugReq): DebugReq.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DebugReq, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DebugReq;
    static deserializeBinaryFromReader(message: DebugReq, reader: jspb.BinaryReader): DebugReq;
}

export namespace DebugReq {
    export type AsObject = {
        debugreq?: DebugConfigReq.AsObject,
        data: Uint8Array | string,
        sendInterrupt: boolean,
    }
}

export class DebugConfigReq extends jspb.Message { 

    hasInstance(): boolean;
    clearInstance(): void;
    getInstance(): commands_common_pb.Instance | undefined;
    setInstance(value?: commands_common_pb.Instance): DebugConfigReq;

    getFqbn(): string;
    setFqbn(value: string): DebugConfigReq;

    getSketchPath(): string;
    setSketchPath(value: string): DebugConfigReq;

    getPort(): string;
    setPort(value: string): DebugConfigReq;

    getInterpreter(): string;
    setInterpreter(value: string): DebugConfigReq;

    getImportDir(): string;
    setImportDir(value: string): DebugConfigReq;

    getProgrammer(): string;
    setProgrammer(value: string): DebugConfigReq;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DebugConfigReq.AsObject;
    static toObject(includeInstance: boolean, msg: DebugConfigReq): DebugConfigReq.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DebugConfigReq, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DebugConfigReq;
    static deserializeBinaryFromReader(message: DebugConfigReq, reader: jspb.BinaryReader): DebugConfigReq;
}

export namespace DebugConfigReq {
    export type AsObject = {
        instance?: commands_common_pb.Instance.AsObject,
        fqbn: string,
        sketchPath: string,
        port: string,
        interpreter: string,
        importDir: string,
        programmer: string,
    }
}

export class DebugResp extends jspb.Message { 
    getData(): Uint8Array | string;
    getData_asU8(): Uint8Array;
    getData_asB64(): string;
    setData(value: Uint8Array | string): DebugResp;

    getError(): string;
    setError(value: string): DebugResp;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DebugResp.AsObject;
    static toObject(includeInstance: boolean, msg: DebugResp): DebugResp.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: DebugResp, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DebugResp;
    static deserializeBinaryFromReader(message: DebugResp, reader: jspb.BinaryReader): DebugResp;
}

export namespace DebugResp {
    export type AsObject = {
        data: Uint8Array | string,
        error: string,
    }
}

export class GetDebugConfigResp extends jspb.Message { 
    getExecutable(): string;
    setExecutable(value: string): GetDebugConfigResp;

    getToolchain(): string;
    setToolchain(value: string): GetDebugConfigResp;

    getToolchainPath(): string;
    setToolchainPath(value: string): GetDebugConfigResp;

    getToolchainPrefix(): string;
    setToolchainPrefix(value: string): GetDebugConfigResp;

    getServer(): string;
    setServer(value: string): GetDebugConfigResp;

    getServerPath(): string;
    setServerPath(value: string): GetDebugConfigResp;


    getToolchainConfigurationMap(): jspb.Map<string, string>;
    clearToolchainConfigurationMap(): void;


    getServerConfigurationMap(): jspb.Map<string, string>;
    clearServerConfigurationMap(): void;


    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetDebugConfigResp.AsObject;
    static toObject(includeInstance: boolean, msg: GetDebugConfigResp): GetDebugConfigResp.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetDebugConfigResp, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetDebugConfigResp;
    static deserializeBinaryFromReader(message: GetDebugConfigResp, reader: jspb.BinaryReader): GetDebugConfigResp;
}

export namespace GetDebugConfigResp {
    export type AsObject = {
        executable: string,
        toolchain: string,
        toolchainPath: string,
        toolchainPrefix: string,
        server: string,
        serverPath: string,

        toolchainConfigurationMap: Array<[string, string]>,

        serverConfigurationMap: Array<[string, string]>,
    }
}

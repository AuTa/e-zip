
// This file was generated by [tauri-specta](https://github.com/oscartbeaumont/tauri-specta). Do not edit this file manually.

/** user-defined commands **/


export const commands = {
async check7zVersion() : Promise<Result<string, SevenzError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("check_7z_version") };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async download7z() : Promise<Result<null, SevenzError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("download_7z") };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async unzipArchives(archives: Archive[], targetDir: string, globalPassword: string | null) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("unzip_archives", { archives, targetDir, globalPassword }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async deleteArchives(paths: string[], onEvent: TAURI_CHANNEL<DeletedArchiveEvent>) : Promise<void> {
    await TAURI_INVOKE("delete_archives", { paths, onEvent });
},
async showArchivesContents(paths: string[], password: string) : Promise<Result<null, null>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("show_archives_contents", { paths, password }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async refreshArchiveContents(archive: Archive, password: string) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("refresh_archive_contents", { archive, password }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async initConfig() : Promise<Result<AppConfig, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("init_config") };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async updateConfig(appConfig: AppConfig) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("update_config", { appConfig }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
}
}

/** user-defined events **/


export const events = __makeEvents__<{
showArchiveContentsEvent: ShowArchiveContentsEvent,
unzipedArchiveEvent: UnzipedArchiveEvent
}>({
showArchiveContentsEvent: "show-archive-contents-event",
unzipedArchiveEvent: "unziped-archive-event"
})

/** user-defined constants **/



/** user-defined types **/

export type AppConfig = { target: Target; autoDelete: boolean; passwords: string[] }
export type Archive = { path: string; password: string | null; codepage: Codepage | null }
export type ArchiveContents = { path: string; contents: unknown; password: string | null; codepage: Codepage | null; multiVolume: ArchiveMultiVolume | null; hasRootDir: boolean }
export type ArchiveMultiVolume = { volumes: string[]; actualPath: string }
export type Codepage = "SHIFT_JIS" | "GB2312" | "BIG5" | "UTF_8" | { other: number }
export type DeletedArchiveEvent = [string, string | null]
export type Fs = { name: string; modified: string | null; parent: string | null }
export type FsNode = { type: "None" } | ({ type: "Dir" } & Fs) | ({ type: "File" } & Fs)
export type IoError = string
export type SevenzError = "NotFound7z" | { NeedPassword: string } | { CommandError: string } | { CommandIoError: IoError } | { InvalidUtf8: string } | { UnsupportedFile: string }
export type ShowArchiveContentsEvent = SpectaResult<ArchiveContents, SevenzError>
export type SpectaResult<T, E> = { status: "ok"; data: T } | { status: "error"; error: E }
export type Target = { dir: string; canInput: boolean }
export type UnzipedArchiveEvent = [string, UnzipedArchiveStatus]
export type UnzipedArchiveStatus = { Ok: string } | "Running" | "Completed"

/** tauri-specta globals **/

import {
	invoke as TAURI_INVOKE,
	Channel as TAURI_CHANNEL,
} from "@tauri-apps/api/core";
import * as TAURI_API_EVENT from "@tauri-apps/api/event";
import { type WebviewWindow as __WebviewWindow__ } from "@tauri-apps/api/webviewWindow";

type __EventObj__<T> = {
	listen: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.listen<T>>;
	once: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.once<T>>;
	emit: null extends T
		? (payload?: T) => ReturnType<typeof TAURI_API_EVENT.emit>
		: (payload: T) => ReturnType<typeof TAURI_API_EVENT.emit>;
};

export type Result<T, E> =
	| { status: "ok"; data: T }
	| { status: "error"; error: E };

function __makeEvents__<T extends Record<string, any>>(
	mappings: Record<keyof T, string>,
) {
	return new Proxy(
		{} as unknown as {
			[K in keyof T]: __EventObj__<T[K]> & {
				(handle: __WebviewWindow__): __EventObj__<T[K]>;
			};
		},
		{
			get: (_, event) => {
				const name = mappings[event as keyof T];

				return new Proxy((() => {}) as any, {
					apply: (_, __, [window]: [__WebviewWindow__]) => ({
						listen: (arg: any) => window.listen(name, arg),
						once: (arg: any) => window.once(name, arg),
						emit: (arg: any) => window.emit(name, arg),
					}),
					get: (_, command: keyof __EventObj__<any>) => {
						switch (command) {
							case "listen":
								return (arg: any) => TAURI_API_EVENT.listen(name, arg);
							case "once":
								return (arg: any) => TAURI_API_EVENT.once(name, arg);
							case "emit":
								return (arg: any) => TAURI_API_EVENT.emit(name, arg);
						}
					},
				});
			},
		},
	);
}

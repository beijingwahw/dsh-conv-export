import type { SessionEvent, SessionHeader, SessionLogSnapshot } from './types.ts';
export interface TranscriptTurn {
    role: 'user' | 'assistant' | 'system' | 'tool';
    text: string;
    time: number;
    seq: number;
}
/** 从日志事件折取最新标题（`session/title` 事件；无则空串）。 */
export declare function titleFromLog(events: readonly SessionEvent[]): string;
/** 从日志快照提取对话轮次（提取后按 seq 稳定排序，防御上游乱序）。 */
export declare function transcriptFromLog(snapshot: SessionLogSnapshot): TranscriptTurn[];
/** 将消息 content（字符串或内容块数组）压平为纯文本。 */
export declare function extractContentText(content: unknown): string;
/** 完整的 Markdown 导出文档（含元信息头）。 */
export declare function transcriptToMarkdown(session: SessionHeader, turns: readonly TranscriptTurn[], options: {
    timestamps: boolean;
}): string;

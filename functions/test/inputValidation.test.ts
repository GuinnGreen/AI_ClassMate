import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { validateScheduleInput } from '../src/inputValidation';

function expectInvalidArgument(data: unknown, message: string) {
  try {
    validateScheduleInput(data);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpsError);
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    return;
  }

  throw new Error('Expected validateScheduleInput to throw an HttpsError');
}

describe('validateScheduleInput', () => {
  it('accepts a supported image payload', () => {
    expect(validateScheduleInput({
      prompt: '  辨識課表  ',
      base64Data: 'YWJj',
      mimeType: 'image/png',
    })).toEqual({
      prompt: '辨識課表',
      base64Data: 'YWJj',
      mimeType: 'image/png',
    });
  });

  it('rejects whitespace-only prompts after trimming', () => {
    expectInvalidArgument({
      prompt: '   ',
      base64Data: 'YWJj',
      mimeType: 'image/png',
    }, '缺少必要參數');
  });

  it('rejects payloads with missing base64 data', () => {
    expectInvalidArgument({
      prompt: '辨識課表',
      mimeType: 'image/png',
    }, '缺少必要參數');
  });

  it('rejects unsupported MIME types', () => {
    expectInvalidArgument({
      prompt: '辨識課表',
      base64Data: 'YWJj',
      mimeType: 'application/pdf',
    }, '不支援的影像格式：application/pdf');
  });

  it('accepts a base64 payload at the 7,000,000-character limit', () => {
    const base64Data = 'a'.repeat(7_000_000);

    expect(validateScheduleInput({
      prompt: '辨識課表',
      base64Data,
      mimeType: 'image/jpeg',
    })).toEqual({
      prompt: '辨識課表',
      base64Data,
      mimeType: 'image/jpeg',
    });
  });

  it('rejects oversized base64 payloads', () => {
    expectInvalidArgument({
      prompt: '辨識課表',
      base64Data: 'a'.repeat(7_000_001),
      mimeType: 'image/jpeg',
    }, '圖片過大（請壓縮至 5MB 以下）');
  });
});

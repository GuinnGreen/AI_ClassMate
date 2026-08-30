import { describe, expect, it } from 'vitest';
import { validateScheduleInput } from '../src/inputValidation';

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

  it('rejects unsupported MIME types', () => {
    expect(() => validateScheduleInput({
      prompt: '辨識課表',
      base64Data: 'YWJj',
      mimeType: 'application/pdf',
    })).toThrow('不支援的影像格式：application/pdf');
  });

  it('rejects oversized base64 payloads', () => {
    expect(() => validateScheduleInput({
      prompt: '辨識課表',
      base64Data: 'a'.repeat(7_000_001),
      mimeType: 'image/jpeg',
    })).toThrow('圖片過大（請壓縮至 5MB 以下）');
  });
});

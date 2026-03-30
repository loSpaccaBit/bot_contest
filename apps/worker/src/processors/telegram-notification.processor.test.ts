import { describe, it, expect } from 'vitest';
import { renderApprovalTemplate } from './telegram-notification.processor';

describe('renderApprovalTemplate', () => {
  it('sostituisce le variabili di testo con escape MarkdownV2', () => {
    const template = 'Ciao {firstName}\\! Username: {domusbetUsername}';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario_123',
      points: 3,
      totalPoints: 10,
    });
    // underscore in username deve essere escapato per MarkdownV2
    expect(result).toContain('mario\\_123');
    expect(result).toContain('Mario');
  });

  it('sostituisce {linkBot} senza escape', () => {
    const template = '[Link bot]({linkBot})';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario',
      points: 1,
      totalPoints: 5,
      linkBot: 'https://t.me/DomusbetBot?start=ref_abc123',
    });
    expect(result).toBe('[Link bot](https://t.me/DomusbetBot?start=ref_abc123)');
  });

  it('sostituisce {linkCanale} senza escape', () => {
    const template = '[Canale]({linkCanale})';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario',
      points: 1,
      totalPoints: 5,
      linkCanale: 'https://t.me/+abc123XYZ',
    });
    expect(result).toBe('[Canale](https://t.me/+abc123XYZ)');
  });

  it('lascia invariati i placeholder non risolti', () => {
    const template = 'Test {linkCanale} fine';
    const result = renderApprovalTemplate(template, {
      firstName: 'Mario',
      domusbetUsername: 'mario',
      points: 1,
      totalPoints: 5,
      // linkCanale non fornito
    });
    // placeholder non risolto rimane
    expect(result).toContain('{linkCanale}');
  });
});

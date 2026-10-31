import { TOOL_TYPES } from '@kerf/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToolPage } from './ToolPage.tsx';

// The page renders before the tool list loads; what it says about the owner's tools waits for
// the API, and everything else comes from the tool library and the methods.

describe('ToolPage', () => {
  it('says what each tool is, with a way back to the tool list', () => {
    for (const type of TOOL_TYPES) {
      const html = renderToString(<ToolPage id={type.id} />);
      expect(html).toContain(type.description.replaceAll("'", '&#x27;'));
      expect(html).toMatch(
        new RegExp(`<h1 tabindex="-1"><span class="k-tool-label">.*${type.name}</span></h1>`),
      );
      expect(html).toContain('<a href="#/tools">All tools</a>');
    }
  });

  it('lists the details Kerf asks for, and the methods that use the tool', () => {
    const html = renderToString(<ToolPage id="miter-saw" />);
    expect(html).toContain('Details Kerf asks for');
    expect(html).toContain('Largest miter');
    // React separates each piece of text with an empty comment.
    const text = html.replaceAll('<!-- -->', '');
    expect(text).toContain('Where to get it: The miter scale on the saw.');
    expect(text).toContain('Square crosscut: with a miter saw, for cutting.');
    expect(text).toContain('Miter: with a miter saw, for cutting.');
  });

  it('says when no method uses a tool, and asks for no details it does not have', () => {
    const html = renderToString(<ToolPage id="table-saw" />);
    expect(html).toContain('No method in Kerf uses it yet');
    expect(html).not.toContain('Details Kerf asks for');
  });
});

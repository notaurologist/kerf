// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { byText, click, mount } from '../test/dom.tsx';
import { ErrorSummary, type SummaryItem, useFormIssues } from './feedback.tsx';

const issues: SummaryItem[] = [{ field: 'name', message: 'Enter a name' }];

function Form() {
  const { issues: found, attempt, report } = useFormIssues<SummaryItem[]>([]);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <ErrorSummary items={found} attempt={attempt} />
      <input id="name" aria-label="Name" />
      <button type="button" onClick={() => report(issues, true)}>
        Save
      </button>
    </form>
  );
}

describe('ErrorSummary', () => {
  it('takes focus each time a save finds problems', async () => {
    window.history.replaceState(null, '', '#/projects/abc/edit');
    const { container } = mount(<Form />);
    expect(container.querySelector('.k-error-summary')).toBeNull();
    const save = byText(container, 'button', 'Save');
    await click(save);
    const summary = container.querySelector('.k-error-summary');
    expect(document.activeElement).toBe(summary);
    save.focus();
    await click(save);
    expect(document.activeElement).toBe(summary);
  });

  it('does not take focus for problems shown before any save', () => {
    mount(<ErrorSummary items={issues} attempt={0} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('moves to the field from its link without changing the screen', async () => {
    window.history.replaceState(null, '', '#/projects/abc/edit');
    const { container } = mount(<Form />);
    await click(byText(container, 'button', 'Save'));
    await click(byText(container, 'a', 'Enter a name'));
    expect(document.activeElement).toBe(container.querySelector('#name'));
    expect(window.location.hash).toBe('#/projects/abc/edit');
  });
});

import { Button } from './Button.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { Stack } from './layout.tsx';
import { usePopover } from './Popover.tsx';
import { Text } from './text.tsx';

// A few actions behind one icon button, such as Print's two sets (#469). They open in a popover
// that closes with Escape or a tap elsewhere, each a button with a line under it saying what it
// covers. Not a menu role: no arrow keys, just buttons in the tab order.

interface MenuAction {
  /** What the button does: a verb and the thing it acts on. */
  label: string;
  /** What it covers, under the button. */
  detail: string;
  onSelect: () => void;
}

export function MenuButton(props: {
  icon: IconName;
  label: string;
  actions: readonly MenuAction[];
}) {
  const popover = usePopover<HTMLDivElement>();
  return (
    <span className="k-menu">
      <button
        type="button"
        className="k-button"
        data-variant="quiet"
        data-icon-only=""
        popoverTarget={popover.id}
        aria-expanded={popover.open}
        title={props.label}
      >
        <Icon name={props.icon} />
        <span className="k-visually-hidden">{props.label}</span>
      </button>
      <div ref={popover.ref} id={popover.id} popover="auto" className="k-popover">
        <Stack gap="s">
          {props.actions.map((action) => (
            <Stack key={action.label} gap="3xs">
              <Button
                variant="secondary"
                onClick={() => {
                  popover.ref.current?.hidePopover();
                  action.onSelect();
                }}
              >
                {action.label}
              </Button>
              <Text tone="muted" size="small">
                {action.detail}
              </Text>
            </Stack>
          ))}
        </Stack>
      </div>
    </span>
  );
}

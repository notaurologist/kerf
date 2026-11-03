import { href } from '../../lib/route.ts';

/** "Restored “Shed”." with the name linking to the project, so it is one tap away. */
export function Restored(props: { project: { id: string; name: string } }) {
  return (
    <>
      Restored “<a href={href({ screen: 'project', id: props.project.id })}>{props.project.name}</a>
      ”.
    </>
  );
}

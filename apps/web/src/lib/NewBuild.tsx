import { Button, Cluster, InfoNotice } from '../ui/index.ts';
import { leaveGate } from '../ui/leave.ts';
import { type BuildCheck, buildCheck, useBuildDiffers } from './build.ts';

/**
 * Offers a reload once the API answers from a newer build than this page's. Ticks not sent yet
 * are kept in storage through it (ticks.ts), and a draft held on screen asks first.
 */
export function NewBuildNotice(props: { check?: BuildCheck; reload?: () => void }) {
  const differs = useBuildDiffers(props.check ?? buildCheck);
  if (!differs) return null;
  const reload = props.reload ?? (() => window.location.reload());
  return (
    <InfoNotice>
      <Cluster>
        <span>Kerf was updated after this page opened. Reload it to use the new version.</span>
        <Button onClick={() => leaveGate.confirm(reload)}>Reload page</Button>
      </Cluster>
    </InfoNotice>
  );
}

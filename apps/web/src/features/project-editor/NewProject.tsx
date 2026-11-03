import { findTemplate, type TemplateDefinition } from '@kerf/core';
import { api, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { href, type ProjectStart } from '../../lib/route.ts';
import type { Project, ProjectSummary } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { Notice, ProblemScreen, ScreenHeader, Stack } from '../../ui/index.ts';
import { ProjectEditor } from './ProjectEditor.tsx';
import { StartChoice, StartedFrom } from './StartChoice.tsx';
import { StartQuestions } from './StartQuestions.tsx';
import { newTitle, startValues } from './start.ts';

export function NewProjectScreen(props: { templateId: string; start?: ProjectStart }) {
  const template = findTemplate(props.templateId);
  if (!template) {
    return (
      <ProblemScreen
        title="New project"
        back={{ href: href({ screen: 'projects' }), label: 'Projects' }}
      >
        There is no template "{props.templateId}".
      </ProblemScreen>
    );
  }
  return <NewProject template={template} start={props.start} />;
}

/**
 * A new project: first how to start (#358), then its form, empty or started from a worked example,
 * an earlier project (#98), or the template's questions (#163). The earlier projects of the
 * template are loaded to offer as starts.
 */
function NewProject(props: { template: TemplateDefinition; start?: ProjectStart }) {
  const { template, start } = props;
  const key = `${template.id}/${JSON.stringify(start ?? null)}`;
  const { loaded, reload } = useLoad<{ earlier: ProjectSummary[]; source: Project | null }>(
    async () => {
      const list = await send(api.api.projects.$get());
      if (!list.ok) return list;
      const earlier = list.value.projects.filter((p) => p.templateId === template.id);
      if (start?.kind !== 'project') return { ok: true as const, value: { earlier, source: null } };
      const source = await send(api.api.projects[':id'].$get({ param: { id: start.id } }));
      if (!source.ok) return source;
      return { ok: true as const, value: { earlier, source: source.value } };
    },
    key,
  );
  return (
    <Loaded state={loaded} loading="Loading…" onRetry={reload} title={newTitle(template)}>
      {({ earlier, source }) => {
        if (!start) {
          return <StartChoice template={template} title={newTitle(template)} earlier={earlier} />;
        }
        const starts = <StartedFrom template={template} start={start} earlier={earlier} />;
        if (start?.kind === 'questions' && template.questions) {
          return (
            <StartQuestions
              key={key}
              template={template}
              questions={template.questions}
              title={newTitle(template)}
              starts={starts}
              editor={(suggested, changeAnswers) => (
                <ProjectEditor
                  template={template}
                  initial={{ name: '', params: suggested.params, inputs: suggested.inputs }}
                  suggested={suggested.about}
                  starts={
                    <>
                      {starts}
                      {changeAnswers}
                    </>
                  }
                />
              )}
            />
          );
        }
        const starting = startValues(template, start, source);
        if (!starting.ok) {
          return (
            <Stack gap="l">
              <ScreenHeader title={newTitle(template)} />
              <Notice>{starting.message}</Notice>
              {starts}
            </Stack>
          );
        }
        return (
          <ProjectEditor
            key={key}
            template={template}
            initial={starting.initial}
            copied={starting.copied}
            starts={starts}
          />
        );
      }}
    </Loaded>
  );
}

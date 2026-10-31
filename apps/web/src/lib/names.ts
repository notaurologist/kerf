/** The button and heading for starting a project from a template, such as "New bench". */
export function newProjectLabel(templateName: string): string {
  return `New ${templateName.charAt(0).toLowerCase()}${templateName.slice(1)}`;
}

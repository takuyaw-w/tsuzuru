export function joinClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className) => className !== undefined && className.length > 0).join(" ");
}

export function element<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Missing page element: ${selector}`);
  return found;
}

export function art(name: string): string {
  return `${import.meta.env.BASE_URL}art/${name}`;
}

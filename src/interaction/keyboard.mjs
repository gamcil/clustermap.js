const editable = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

function eventMatches(event, selector) {
  const path = event.composedPath?.() || [event.target];
  return path.some((node) => node?.closest?.(selector) || node?.isContentEditable);
}

export const isEditingEvent = (event) => eventMatches(event, editable);
export const isControlEvent = (event) => eventMatches(event, `${editable}, button, summary, a[href]`);

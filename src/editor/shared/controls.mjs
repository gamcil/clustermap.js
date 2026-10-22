// Shared by shadow components and light DOM popovers. Keep defaults easy to override.
export const controlStyles = `
:host([hidden]), :where(.cm-data-ui)[hidden], :where(:host,.cm-data-ui) [hidden] { display:none!important; }
:where(:host,.cm-data-ui) form { margin:0; }
:where(:host,.cm-data-ui) :is(button,input,select,textarea) { box-sizing:border-box; font:inherit; color:inherit; }
:where(:host,.cm-data-ui) :where(button,input:not([type=color]):not([type=checkbox]):not([type=range]),select,textarea) {
  min-height:var(--cm-control-height,30px);
  padding:var(--cm-control-padding,4px 8px);
  border:1px solid var(--cm-border,#cbd3de);
  border-radius:var(--cm-control-radius,6px);
  background:var(--cm-surface,#fff);
}
:where(:host,.cm-data-ui) input[type=color] { width:30px; height:22px; padding:0; border:0; background:transparent; cursor:pointer; }
:where(:host,.cm-data-ui) :is(input[type=checkbox],button,summary) { cursor:pointer; }
:where(:host,.cm-data-ui) :is(input,textarea)::placeholder { color:var(--cm-muted,#687586); }
:where(:host,.cm-data-ui) button:where(:hover:not(:disabled)) { border-color:var(--cm-accent,#78a9ed); background:var(--cm-hover,#f4f8ff); }
:where(:host,.cm-data-ui) button:disabled { color:var(--cm-muted,#8993a1); opacity:.45; cursor:default; }
:where(:host,.cm-data-ui) :is(button,summary):focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:2px; }
:where(:host,.cm-data-ui) :is(input,select,textarea):focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:-2px; }
`;

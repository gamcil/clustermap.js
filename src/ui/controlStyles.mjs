// Shared by shadow components and light DOM popovers. Keep defaults easy to override.
export const controlStyles = `
:host([hidden]), :where(.cm-ui)[hidden], :where(:host,.cm-ui) [hidden] { display:none!important; }
:where(:host,.cm-ui) :where(form) { margin:0; }
:where(:host,.cm-ui) :where(.cm-button,.cm-field,.cm-disclosure) { box-sizing:border-box; font:inherit; color:inherit; }
:where(:host,.cm-ui) :where(.cm-button,.cm-field:not([type=color]):not([type=checkbox]):not([type=range])) {
  min-height:var(--cm-control-height,var(--_cm-control-height,30px));
  padding:var(--cm-control-padding,var(--_cm-control-padding,4px 8px));
  border:1px solid var(--cm-border,var(--_cm-border,#cbd3de));
  border-radius:var(--cm-control-radius,var(--_cm-control-radius,6px));
  background:var(--cm-surface,var(--_cm-surface,#fff));
}
:where(:host,.cm-ui) :where(.cm-field[type=color]) { width:30px; height:22px; padding:0; border:0; background:transparent; cursor:pointer; }
:where(:host,.cm-ui) :where(.cm-button,.cm-disclosure,.cm-field[type=checkbox]) { cursor:pointer; }
:where(:host,.cm-ui) :where(.cm-field)::placeholder { color:var(--cm-muted,var(--_cm-muted,#687586)); }
:where(:host,.cm-ui) :where(:is(.cm-button,.cm-disclosure):hover:not(:disabled)) { border-color:var(--cm-accent,var(--_cm-accent,#78a9ed)); background:var(--cm-hover,var(--_cm-hover,#f4f8ff)); }
:where(:host,.cm-ui) :where(.cm-button:disabled) { color:var(--cm-muted,var(--_cm-muted,#8993a1)); opacity:.45; cursor:default; }
:where(:host,.cm-ui) :where(.cm-field:disabled) { color:var(--cm-muted,var(--_cm-muted,#8993a1)); opacity:.6; cursor:default; }
:where(:host,.cm-ui) :where(:is(.cm-button,.cm-disclosure):focus-visible) { outline:2px solid var(--cm-focus-ring,var(--_cm-focus-ring,#1677ff)); outline-offset:2px; }
:where(:host,.cm-ui) :where(.cm-field:focus-visible) { outline:2px solid var(--cm-focus-ring,var(--_cm-focus-ring,#1677ff)); outline-offset:-2px; }
:where(:host,.cm-ui) :where(.cm-menu-item,clinker-action-menu > .cm-button) { border:0; border-radius:4px; background:transparent; text-align:left; }
:where(:host,.cm-ui) :where(:is(.cm-menu-item,clinker-action-menu > .cm-button):hover:not(:disabled)) { background:var(--cm-hover,var(--_cm-hover,#e3ecf8)); }
:where(:host,.cm-ui) :where(:is(.cm-menu-item,clinker-action-menu > .cm-button)[aria-pressed=true]) { background:var(--cm-selection,var(--_cm-selection,#d6e6fc)); }
`;

// Light DOM needs an owned class scope; shadow component variants stay easy to override.
export const lightControlStyles = controlStyles.replaceAll(":where(:host,.cm-ui)", ".cm-ui");

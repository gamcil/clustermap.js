/** Shared activation and horizontal keyboard navigation for option buttons. */
export function bindOptionButtons(group, choose) {
  group.addEventListener("click", (event) => choose(event.target.closest("button")));
  group.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = [...group.querySelectorAll("button:not(:disabled)")];
    if (!buttons.length) return;
    const index = buttons.indexOf(event.target);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (event.key === "ArrowLeft" ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault(); buttons[next].focus(); choose(buttons[next]);
  });
}

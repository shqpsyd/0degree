import {
  useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes,
  type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" };

export function Button({ variant = "primary", className = "", type = "button", ...rest }: ButtonProps) {
  const cls = variant === "primary" ? "btn" : variant === "ghost" ? "ghost" : `btn ${variant}`;
  return <button type={type} className={`${cls} ${className}`.trim()} {...rest} />;
}

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`.trim()} {...rest} />;
}

type FieldProps = { label: string; hint?: string };

export function TextField({ label, hint, id, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label className="field-label" htmlFor={fieldId}>
      <span>{label}</span>
      <input id={fieldId} className="field" aria-describedby={hint ? `${fieldId}-hint` : undefined} {...rest} />
      {hint && <small id={`${fieldId}-hint`} className="muted">{hint}</small>}
    </label>
  );
}

export function TextArea({ label, hint, id, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <label className="field-label" htmlFor={fieldId}>
      <span>{label}</span>
      <textarea id={fieldId} className="field" aria-describedby={hint ? `${fieldId}-hint` : undefined} {...rest} />
      {hint && <small id={`${fieldId}-hint`} className="muted">{hint}</small>}
    </label>
  );
}

export function EmptyState({ icon = "🌱", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">{icon}</span>
      <p><strong>{title}</strong></p>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

/** 状态提示。error 使用 role=alert 立即播报，其余使用 role=status。 */
export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: ReactNode }) {
  return <p className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

type ModalProps = { open: boolean; title: string; onClose: () => void; children: ReactNode; actions?: ReactNode };

/** 基于原生 <dialog>：自带焦点限制、Esc 关闭和背景遮罩。 */
export function Modal({ open, title, onClose, children, actions }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <h2 id={titleId}>{title}</h2>
      <div className="stack">{children}</div>
      {actions && <div className="row modal-actions">{actions}</div>}
    </dialog>
  );
}

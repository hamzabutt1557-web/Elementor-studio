"use client";
import { useEffect, useRef, useState } from "react";
import type { DesignNode } from "@/lib/design";
import {
  formatText,
  replaceText,
  textRuns,
  type TextMark,
  type TextRun,
} from "@/lib/text-format";
import FontPicker from "./font-picker";
export default function TextEditor({
  node,
  onSave,
}: {
  node: DesignNode;
  onSave: (patch: Partial<DesignNode>) => void;
}) {
  const [text, setText] = useState(node.text || ""),
    [runs, setRuns] = useState<TextRun[]>(textRuns(node.text || "", node.runs));
  const selection = useRef<[number, number]>([0, 0]);
  const [rangeFont, setRangeFont] = useState("");
  useEffect(() => {
    setText(node.text || "");
    setRuns(textRuns(node.text || "", node.runs));
  }, [node.id, node.text, node.runs]);
  function save(nextText = text, nextRuns = runs) {
    if (
      nextText !== (node.text || "") ||
      JSON.stringify(nextRuns) !==
        JSON.stringify(textRuns(node.text || "", node.runs))
    )
      onSave({ text: nextText, runs: nextRuns });
  }
  function format(mark: TextMark, value?: string) {
    const next = formatText(text, runs, ...selection.current, mark, value);
    setRuns(next);
    save(text, next);
  }
  return (
    <div className="text-editor">
      <label>
        Text
        <textarea
          aria-label="Edit selected text"
          value={text}
          maxLength={12000}
          onSelect={(e) => {
            selection.current = [
              e.currentTarget.selectionStart,
              e.currentTarget.selectionEnd,
            ];
            let end = 0;
            const selectedRun = runs.find((run) => {
              end += run.text.length;
              return end > e.currentTarget.selectionStart;
            });
            setRangeFont(selectedRun?.fontFamily || "");
          }}
          onChange={(e) => {
            const value = e.target.value;
            setRuns(replaceText(text, value, runs));
            setText(value);
          }}
          onBlur={(event) => {
            if (
              !event.currentTarget
                .closest(".text-editor")
                ?.contains(event.relatedTarget as Node)
            )
              save();
          }}
        />
      </label>
      <div className="text-toolbar" role="group" aria-label="Text formatting">
        {(["bold", "italic", "underline"] as const).map((mark, i) => (
          <button
            key={mark}
            type="button"
            title={mark}
            aria-label={mark}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format(mark)}
          >
            {["B", "I", "U"][i]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="primary"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => save()}
      >
        Apply text
      </button>
      <small>
        Highlight words to format them. With no selection, formatting applies to
        the whole text.
      </small>
      <details>
        <summary>Font for selected words</summary>
        <FontPicker
          label="Selected words font"
          value={rangeFont}
          onChange={(value) => {
            setRangeFont(value);
            format("fontFamily", value);
          }}
        />
      </details>
    </div>
  );
}

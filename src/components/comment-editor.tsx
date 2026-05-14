"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Emoji from "@tiptap/extension-emoji";
import { EmojiItem, emojis } from "@tiptap/extension-emoji";
import Mention from "@tiptap/extension-mention";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { createClient } from "@/lib/supabase/client";

type EmojiSuggestionListProps = {
  items: EmojiItem[];
  command: (item: EmojiItem) => void;
};

type EmojiSuggestionListRef = {
  onKeyDown: (event: globalThis.KeyboardEvent) => boolean;
};

const EmojiSuggestionList = forwardRef<EmojiSuggestionListRef, EmojiSuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const effectiveIndex = items.length ? Math.min(selectedIndex, items.length - 1) : 0;

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: globalThis.KeyboardEvent) => {
        if (!items.length) return false;

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((index) => (index + items.length - 1) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          selectItem(effectiveIndex);
          return true;
        }

        return false;
      },
    }));

    if (!items.length) {
      return <div className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-500">Nessun emoji trovato</div>;
    }

    return (
      <div className="max-h-48 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl">
        {items.map((item, index) => {
          const shortcode = item.shortcodes?.[0] ?? item.name;
          const active = index === effectiveIndex;

          return (
            <button
              key={`${item.name}-${shortcode}`}
              type="button"
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(index);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span className="text-base leading-none">{item.emoji ?? "?"}</span>
              <span className="truncate">:{shortcode}:</span>
            </button>
          );
        })}
      </div>
    );
  },
);

EmojiSuggestionList.displayName = "EmojiSuggestionList";

type MentionItem = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type MentionSuggestionListProps = {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
};

type MentionSuggestionListRef = {
  onKeyDown: (event: globalThis.KeyboardEvent) => boolean;
};

const MentionSuggestionList = forwardRef<MentionSuggestionListRef, MentionSuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const effectiveIndex = items.length ? Math.min(selectedIndex, items.length - 1) : 0;

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.username });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: globalThis.KeyboardEvent) => {
        if (!items.length) return false;

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((index) => (index + items.length - 1) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          selectItem(effectiveIndex);
          return true;
        }

        return false;
      },
    }));

    if (!items.length) {
      return <div className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-500">Nessun utente trovato</div>;
    }

    return (
      <div className="max-h-48 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl">
        {items.map((item, index) => {
          const active = index === effectiveIndex;

          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(index);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {item.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.avatar_url} alt="" className="h-5 w-5 rounded-full" />
              ) : (
                <div className="h-5 w-5 rounded-full bg-zinc-300" />
              )}
              <span className="truncate">@{item.username}</span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionSuggestionList.displayName = "MentionSuggestionList";

type CommentEditorProps = {
  name: string;
  placeholder?: string;
  onSubmit?: () => void;
  rows?: number;
};

export function CommentEditor({ name, placeholder = "Scrivi il tuo commento", onSubmit, rows = 3 }: CommentEditorProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  
  const editor = useEditor({
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches
    extensions: [
      StarterKit.configure({
        heading: false, // Disable headings in comments
        codeBlock: false, // Disable code blocks
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline" } }),
      Underline,
      Emoji.configure({
        enableEmoticons: true,
        suggestion: {
          items: ({ query }) => {
            const normalizedQuery = query.toLowerCase();
            return emojis
              .filter((item) => {
                const shortcodeText = (item.shortcodes ?? []).join(" ").toLowerCase();
                const tagText = (item.tags ?? []).join(" ").toLowerCase();
                const nameText = item.name.toLowerCase();

                return (
                  shortcodeText.includes(normalizedQuery) ||
                  tagText.includes(normalizedQuery) ||
                  nameText.includes(normalizedQuery)
                );
              })
              .slice(0, 10);
          },
          render: () => {
            let reactRenderer: ReactRenderer<EmojiSuggestionListRef>;
            let popup: TippyInstance | null = null;

            return {
              onStart: (props) => {
                reactRenderer = new ReactRenderer(EmojiSuggestionList, {
                  editor: props.editor,
                  props,
                });

                if (!props.clientRect) return;

                popup = tippy(document.body, {
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
                  appendTo: () => document.body,
                  content: reactRenderer.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate: (props) => {
                reactRenderer.updateProps(props);

                if (!props.clientRect) return;

                popup?.setProps({
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
                });
              },

              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }

                return reactRenderer.ref?.onKeyDown(props.event) ?? false;
              },

              onExit: () => {
                popup?.destroy();
                reactRenderer.destroy();
              },
            };
          },
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention text-blue-600 font-medium",
        },
        suggestion: {
          items: async ({ query }) => {
            const supabase = createClient();
            const normalizedQuery = query.toLowerCase();

            const { data } = await supabase
              .schema("blog")
              .from("profiles")
              .select("id, username, avatar_url")
              .ilike("username", `%${normalizedQuery}%`)
              .limit(10);

            return (data || []) as MentionItem[];
          },
          render: () => {
            let reactRenderer: ReactRenderer<MentionSuggestionListRef>;
            let popup: TippyInstance | null = null;

            return {
              onStart: (props) => {
                reactRenderer = new ReactRenderer(MentionSuggestionList, {
                  editor: props.editor,
                  props,
                });

                if (!props.clientRect) return;

                popup = tippy(document.body, {
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
                  appendTo: () => document.body,
                  content: reactRenderer.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate: (props) => {
                reactRenderer.updateProps(props);

                if (!props.clientRect) return;

                popup?.setProps({
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
                });
              },

              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }

                return reactRenderer.ref?.onKeyDown(props.event) ?? false;
              },

              onExit: () => {
                popup?.destroy();
                reactRenderer.destroy();
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2 min-h-[4em]",
      },
    },
    onCreate: ({ editor }) => {
      // Sync initial content
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = editor.getHTML();
      }
    },
    onUpdate: ({ editor }) => {
      // Sync content to hidden input for form submission
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = editor.getHTML();
      }
    },
  });

  useEffect(() => {
    if (!editor) return;

    // Add Ctrl+Enter keyboard shortcut
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onSubmit?.();
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, onSubmit]);

  // Set min-height based on rows prop
  const minHeight = `${rows * 1.5}em`;

  return (
    <div className="relative">
      <div
        className="rounded-md border border-zinc-300 bg-white text-sm focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>
      
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} ref={hiddenInputRef} required />
      
      {/* Toolbar hint */}
      <div className="mt-1 text-[10px] text-zinc-500">
        <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 font-mono text-[9px]">Ctrl</kbd>
        {" + "}
        <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
        {" per inviare"}
      </div>
    </div>
  );
}

"use client";

import { ChangeEvent, forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Emoji from "@tiptap/extension-emoji";
import { EmojiItem, emojis } from "@tiptap/extension-emoji";
import { Markdown } from "@tiptap/markdown";
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
        if (!items.length) {
          return false;
        }

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
      return <div className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-500">No emoji found</div>;
    }

    return (
      <div className="max-h-56 w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl">
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

function looksLikeMarkdown(text: string) {
  const normalized = text.trim();

  if (!normalized || normalized.length < 3) {
    return false;
  }

  return [
    /^#{1,6}\s/m,
    /^>\s/m,
    /^[-*+]\s/m,
    /^\d+\.\s/m,
    /^-\s\[(?: |x|X)\]\s/m,
    /```[\s\S]*```/m,
    /`[^`]+`/m,
    /\*\*[^*]+\*\*/m,
    /~~[^~]+~~/m,
    /==[^=]+==/m,
    /!?\[[^\]]+\]\([^\)]+\)/m,
  ].some((pattern) => pattern.test(normalized));
}

function ToolButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
      }`}
    >
      {label}
    </button>
  );
}

export function PostEditorFields({
  contentFieldName = "content",
  contentFormatFieldName = "content_format",
  initialContent = "",
  placeholder = "Write your post like a Notion page...",
}: {
  contentFieldName?: string;
  contentFormatFieldName?: string;
  initialContent?: string;
  placeholder?: string;
}) {
  const [html, setHtml] = useState(initialContent);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Markdown,
      Underline,
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Typography,
      Emoji.configure({
        enableEmoticons: true,
        suggestion: {
          items: ({ query }) => {
            const normalizedQuery = query.trim().toLowerCase();

            return emojis
              .filter((emoji) => {
                if (!normalizedQuery) {
                  return true;
                }

                const shortcodeText = emoji.shortcodes?.join(" ").toLowerCase() ?? "";
                const tagText = emoji.tags?.join(" ").toLowerCase() ?? "";
                const nameText = emoji.name.toLowerCase();

                return (
                  shortcodeText.includes(normalizedQuery) ||
                  tagText.includes(normalizedQuery) ||
                  nameText.includes(normalizedQuery)
                );
              })
              .slice(0, 12);
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

                if (!props.clientRect) {
                  return;
                }

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

                if (!props.clientRect) {
                  return;
                }

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
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "notion-editor",
      },
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;

        if (!clipboardData) {
          return false;
        }

        const html = clipboardData.getData("text/html");
        const text = clipboardData.getData("text/plain");

        if (html || !looksLikeMarkdown(text)) {
          return false;
        }

        event.preventDefault();
        view.dispatch(view.state.tr);
        editor?.chain().focus().insertContent(text, { contentType: "markdown" }).run();
        return true;
      },
    },
    onUpdate({ editor: instance }) {
      setHtml(instance.getHTML());
    },
  });

  const text = editor?.getText() ?? "";
  const stats = {
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    chars: text.length,
  };

  const filteredEmojis = useMemo(() => {
    const query = emojiQuery.trim().toLowerCase();

    if (!query) {
      return emojis.slice(0, 80);
    }

    return emojis
      .filter((emoji) => {
        const shortcodes = emoji.shortcodes?.join(" ").toLowerCase() ?? "";
        const tags = emoji.tags?.join(" ").toLowerCase() ?? "";
        const name = emoji.name?.toLowerCase() ?? "";

        return shortcodes.includes(query) || tags.includes(query) || name.includes(query);
      })
      .slice(0, 120);
  }, [emojiQuery]);

  const insertEmoji = (shortcode: string, fallbackEmoji?: string) => {
    if (!editor) {
      return;
    }

    const didInsert = editor.chain().focus().setEmoji(shortcode).run();

    if (!didInsert && fallbackEmoji) {
      editor.chain().focus().insertContent(fallbackEmoji).run();
    }

    setShowEmojiPicker(false);
    setEmojiQuery("");
  };

  const setLink = () => {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl || "https://");

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const onSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !editor) {
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUploadError("You need to be logged in to upload images.");
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-images")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        setUploadError(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
      editor.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run();
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 p-2.5 md:gap-2 md:p-3">
        <ToolButton
          label="Bold"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolButton
          label="Italic"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          label="Underline"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolButton
          label="Strike"
          active={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolButton
          label="Highlight"
          active={editor?.isActive("highlight")}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
        />
        <ToolButton
          label="H2"
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolButton
          label="H3"
          active={editor?.isActive("heading", { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolButton
          label="Bullet"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          label="Number"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          label="Task"
          active={editor?.isActive("taskList")}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        />
        <ToolButton
          label="Quote"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          label="Code"
          active={editor?.isActive("codeBlock")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((current) => !current)}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
            title="Search and insert emoji"
          >
            Emoji
          </button>
          {showEmojiPicker && (
            <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
              <input
                type="text"
                value={emojiQuery}
                onChange={(event) => setEmojiQuery(event.target.value)}
                placeholder="Search emoji..."
                className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs"
                autoFocus
              />
              <div className="mt-2 grid max-h-56 grid-cols-8 gap-1 overflow-y-auto pr-1">
                {filteredEmojis.map((emoji) => {
                  const shortcode = emoji.shortcodes?.[0] ?? emoji.name;
                  const symbol = emoji.emoji ?? "?";

                  return (
                    <button
                      key={`${emoji.name}-${shortcode}`}
                      type="button"
                      onClick={() => insertEmoji(shortcode, emoji.emoji)}
                      className="rounded-md p-1.5 text-lg leading-none hover:bg-zinc-100"
                      title={`:${shortcode}:`}
                    >
                      {symbol}
                    </button>
                  );
                })}
              </div>
              {!filteredEmojis.length && (
                <p className="px-1 py-2 text-xs text-zinc-500">No emoji found.</p>
              )}
              <div className="mt-1 flex justify-between px-1 text-[11px] text-zinc-500">
                <span>Tip: type `:` in editor</span>
                <button
                  type="button"
                  className="text-zinc-700 hover:underline"
                  onClick={() => {
                    setShowEmojiPicker(false);
                    setEmojiQuery("");
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
        <ToolButton label="Link" active={editor?.isActive("link")} onClick={setLink} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
        >
          {uploading ? "Uploading..." : "Image"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onSelectImage}
        />
        <button
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
        >
          Redo
        </button>
        <button
          type="button"
          onClick={() => setShowMarkdownHelp((current) => !current)}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
        >
          Markdown
        </button>
      </div>

      <div className="border-b border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-500">
        {stats.words} words, {stats.chars} chars. Tip: type markdown shortcuts like `#`, `&gt;`, `-`, `1.` or `- [ ]` while writing.
      </div>

      {showMarkdownHelp && (
        <div className="grid gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="font-semibold text-zinc-800">Headings</p>
            <p>`#` `##` `###` then space</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-800">Lists</p>
            <p>`-` `*` `+` or `1.` then space</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-800">Tasks</p>
            <p>`- [ ]` or `- [x]` then space</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-800">Formatting</p>
            <p>`&gt;` quote, `` `code` ``, `~~strike~~`, `==highlight==`</p>
          </div>
        </div>
      )}

      <div className="p-5 md:p-6">
        {editor && (
          <BubbleMenu editor={editor} className="rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg">
            <div className="flex items-center gap-1">
              <ToolButton
                label="Bold"
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <ToolButton
                label="Italic"
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
              <ToolButton
                label="Underline"
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              />
              <ToolButton
                label="Highlight"
                active={editor.isActive("highlight")}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              />
              <ToolButton label="Link" active={editor.isActive("link")} onClick={setLink} />
            </div>
          </BubbleMenu>
        )}

        {editor && (
          <FloatingMenu editor={editor} className="rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
              >
                List
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
              >
                Task
              </button>
            </div>
          </FloatingMenu>
        )}

        <EditorContent editor={editor} />
        {uploadError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Image upload failed: {uploadError}
          </p>
        )}
      </div>

      <input type="hidden" name={contentFormatFieldName} value="richtext" />
      <input type="hidden" name={contentFieldName} value={html} required />
    </section>
  );
}

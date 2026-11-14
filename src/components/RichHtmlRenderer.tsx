/**
 * RichHtmlRenderer — Pure React Native HTML & Markdown renderer for JanitorAI / Chub descriptions.
 * Supports:
 * - Block & image alignment: left, center, right (<center>, align="...", style="text-align: ...")
 * - Embedded images: <img src="..."> and Markdown ![alt](url)
 * - Inline styling: <b>/<strong>, <i>/<em>, <u>, <s>/<del>, <font color>, <span style="color:...">, <a href>
 * - Structural elements: <h1>-<h4>, <p>, <div>, <br>, <hr>, <blockquote>, <ul>/<ol>/<li>
 * - HTML entities (&nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;, numeric entities)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Linking,
  TextStyle,
} from 'react-native';
import { colors } from '../theme/colors';

export type TextAlignMode = 'left' | 'center' | 'right';

interface RichHtmlRendererProps {
  content: string;
  baseColor?: string;
  fontSize?: number;
  lineHeight?: number;
}

interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  href?: string;
}

type BlockNode =
  | { type: 'text'; align: TextAlignMode; heading?: number; quote?: boolean; bullet?: string; spans: InlineSpan[] }
  | { type: 'image'; align: TextAlignMode; url: string; alt?: string }
  | { type: 'hr' };

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rdquo;/gi, '”')
    .replace(/&ldquo;/gi, '“')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&bull;/gi, '•')
    .replace(/&hellip;/gi, '…')
    .replace(/&#(\d+);/g, (_, num) => {
      const code = parseInt(num, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function extractAlignment(attrs: string, fallback: TextAlignMode): TextAlignMode {
  if (!attrs) return fallback;
  const styleAlign = attrs.match(/text-align\s*:\s*(left|center|right)/i);
  if (styleAlign) return styleAlign[1].toLowerCase() as TextAlignMode;
  const attrAlign = attrs.match(/\balign\s*=\s*["']?(left|center|right)["']?/i);
  if (attrAlign) return attrAlign[1].toLowerCase() as TextAlignMode;
  const justify = attrs.match(/justify-content\s*:\s*(flex-start|center|flex-end)/i);
  if (justify) {
    const val = justify[1].toLowerCase();
    if (val === 'center') return 'center';
    if (val === 'flex-end') return 'right';
    return 'left';
  }
  return fallback;
}

function extractColor(attrs: string): string | undefined {
  if (!attrs) return undefined;
  const styleCol = attrs.match(/(?:^|[;\s"'])color\s*:\s*([^;"']+)/i);
  if (styleCol) return styleCol[1].trim();
  const fontCol = attrs.match(/\bcolor\s*=\s*["']?([^"'\s>]+)["']?/i);
  if (fontCol) return fontCol[1].trim();
  return undefined;
}

function parseInlineSpans(raw: string, inherited: Omit<InlineSpan, 'text'> = {}): InlineSpan[] {
  if (!raw) return [];
  const spans: InlineSpan[] = [];

  // Tokenize inline HTML tags and Markdown tokens
  const tokenRegex =
    /(<\/?(?:b|strong|i|em|u|s|del|strike|span|font|a|code|mark)\b[^>]*>|\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/gi;

  let lastIndex = 0;
  const stack: Omit<InlineSpan, 'text'>[] = [{ ...inherited }];

  const currentStyle = (): Omit<InlineSpan, 'text'> => {
    return stack.reduce<Omit<InlineSpan, 'text'>>((acc, s) => ({ ...acc, ...s }), {});
  };

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const plain = decodeHtmlEntities(raw.slice(lastIndex, match.index));
      if (plain) spans.push({ text: plain, ...currentStyle() });
    }

    const tok = match[0];
    const lower = tok.toLowerCase();

    if (lower.startsWith('</')) {
      if (stack.length > 1) stack.pop();
    } else if (lower.startsWith('<')) {
      const tagMatch = lower.match(/^<([a-z0-9]+)/);
      const tag = tagMatch?.[1] || '';
      const attrs = tok.slice(tag.length + 1, -1);
      const next: Omit<InlineSpan, 'text'> = {};
      if (tag === 'b' || tag === 'strong') next.bold = true;
      else if (tag === 'i' || tag === 'em') next.italic = true;
      else if (tag === 'u') next.underline = true;
      else if (tag === 's' || tag === 'del' || tag === 'strike') next.strike = true;
      else if (tag === 'a') {
        const hrefMatch = attrs.match(/href\s*=\s*["']?([^"'\s>]+)["']?/i);
        if (hrefMatch) next.href = hrefMatch[1];
        next.underline = true;
        next.color = colors.lime;
      }
      const col = extractColor(attrs);
      if (col) next.color = col;
      if (!tok.endsWith('/>')) {
        stack.push(next);
      }
    } else if (tok.startsWith('**') && tok.endsWith('**')) {
      spans.push({ text: decodeHtmlEntities(tok.slice(2, -2)), ...currentStyle(), bold: true });
    } else if (tok.startsWith('*') && tok.endsWith('*')) {
      spans.push({ text: decodeHtmlEntities(tok.slice(1, -1)), ...currentStyle(), italic: true });
    } else if (tok.startsWith('~~') && tok.endsWith('~~')) {
      spans.push({ text: decodeHtmlEntities(tok.slice(2, -2)), ...currentStyle(), strike: true });
    } else if (tok.startsWith('[') && tok.includes('](')) {
      const mdLink = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mdLink) {
        spans.push({
          text: decodeHtmlEntities(mdLink[1]),
          ...currentStyle(),
          href: mdLink[2],
          underline: true,
          color: colors.lime,
        });
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    const tail = decodeHtmlEntities(raw.slice(lastIndex));
    if (tail) spans.push({ text: tail, ...currentStyle() });
  }

  return spans;
}

function parseRichContent(input: string): BlockNode[] {
  if (!input || !input.trim()) return [];

  // Normalize line breaks and strip <script>/<style> tags safely
  let src = input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\r\n/g, '\n');

  // Convert markdown images ![alt](url) into <img src="url" alt="alt" />
  src = src.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi, '<img src="$2" alt="$1" />');

  const blocks: BlockNode[] = [];

  // Split by block-level HTML tags & <br> / <hr> / <img>
  const blockRegex =
    /(<\/?(?:center|div|p|h[1-6]|blockquote|ul|ol|li|section|article|header|footer)\b[^>]*>|<br\s*\/?>|<hr\s*\/?>|<img\b[^>]*>)/gi;

  const alignStack: TextAlignMode[] = ['left'];
  let inQuote = false;
  let listType: 'ul' | 'ol' | null = null;
  let olCounter = 0;
  let activeHeading: number | undefined;
  let buffer = '';

  const flushBuffer = (bullet?: string) => {
    const trimmed = buffer.replace(/^\n+|\n+$/g, '');
    buffer = '';
    if (!trimmed) return;

    // Handle plain-text newlines & markdown headings / rules when not pure HTML
    const lines = trimmed.split('\n');
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      if (/^[-*_]{3,}$/.test(cleanLine)) {
        blocks.push({ type: 'hr' });
        continue;
      }

      const mdHeading = cleanLine.match(/^(#{1,4})\s+(.+)$/);
      if (mdHeading && !activeHeading) {
        blocks.push({
          type: 'text',
          align: alignStack[alignStack.length - 1],
          heading: mdHeading[1].length,
          quote: inQuote,
          spans: parseInlineSpans(mdHeading[2], { bold: true }),
        });
        continue;
      }

      const mdQuote = cleanLine.match(/^>\s+(.+)$/);
      if (mdQuote) {
        blocks.push({
          type: 'text',
          align: alignStack[alignStack.length - 1],
          quote: true,
          spans: parseInlineSpans(mdQuote[1]),
        });
        continue;
      }

      const spans = parseInlineSpans(cleanLine, activeHeading ? { bold: true } : {});
      if (spans.length > 0) {
        blocks.push({
          type: 'text',
          align: alignStack[alignStack.length - 1],
          heading: activeHeading,
          quote: inQuote,
          bullet,
          spans,
        });
      }
    }
  };

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(src)) !== null) {
    buffer += src.slice(lastIndex, match.index);
    const tagStr = match[0];
    const lower = tagStr.toLowerCase();

    if (lower.startsWith('<br')) {
      flushBuffer();
    } else if (lower.startsWith('<hr')) {
      flushBuffer();
      blocks.push({ type: 'hr' });
    } else if (lower.startsWith('<img')) {
      flushBuffer();
      const srcMatch = tagStr.match(/src\s*=\s*["']?([^"'\s>]+)["']?/i);
      const altMatch = tagStr.match(/alt\s*=\s*["']([^"']*)["']/i);
      if (srcMatch?.[1]) {
        const imgAlign = extractAlignment(tagStr, alignStack[alignStack.length - 1]);
        blocks.push({
          type: 'image',
          align: imgAlign,
          url: srcMatch[1],
          alt: altMatch?.[1],
        });
      }
    } else if (lower.startsWith('</')) {
      const closeTag = lower.match(/^<\/([a-z0-9]+)/)?.[1] || '';
      if (closeTag === 'li') {
        const bullet = listType === 'ol' ? `${olCounter}.` : '•';
        flushBuffer(bullet);
      } else {
        flushBuffer();
      }
      if (
        closeTag === 'center' ||
        closeTag === 'div' ||
        closeTag === 'p' ||
        closeTag.startsWith('h') ||
        closeTag === 'section' ||
        closeTag === 'article'
      ) {
        if (alignStack.length > 1) alignStack.pop();
      }
      if (closeTag.startsWith('h')) activeHeading = undefined;
      if (closeTag === 'blockquote') inQuote = false;
      if (closeTag === 'ul' || closeTag === 'ol') {
        listType = null;
        olCounter = 0;
      }
    } else {
      flushBuffer();
      const openTag = lower.match(/^<([a-z0-9]+)/)?.[1] || '';
      const attrs = tagStr.slice(openTag.length + 1, -1);
      if (openTag === 'center') {
        alignStack.push('center');
      } else if (
        openTag === 'div' ||
        openTag === 'p' ||
        openTag.startsWith('h') ||
        openTag === 'section' ||
        openTag === 'article'
      ) {
        alignStack.push(extractAlignment(attrs, alignStack[alignStack.length - 1]));
      }
      if (openTag.startsWith('h')) {
        const lvl = parseInt(openTag.slice(1), 10);
        activeHeading = Number.isFinite(lvl) ? lvl : 2;
      }
      if (openTag === 'blockquote') inQuote = true;
      if (openTag === 'ul') {
        listType = 'ul';
        olCounter = 0;
      }
      if (openTag === 'ol') {
        listType = 'ol';
        olCounter = 0;
      }
      if (openTag === 'li' && listType === 'ol') {
        olCounter += 1;
      }
    }

    lastIndex = blockRegex.lastIndex;
  }

  buffer += src.slice(lastIndex);
  flushBuffer();

  return blocks;
}

const RichImageBlock: React.FC<{ url: string; align: TextAlignMode }> = ({ url, align }) => {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 10);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    Image.getSize(
      url,
      (w, h) => {
        if (mounted && w > 0 && h > 0) {
          setAspectRatio(Math.max(0.45, Math.min(4.5, w / h)));
        }
      },
      () => {
        // Keep safe default aspect ratio on CORS / metadata error
      }
    );
    return () => {
      mounted = false;
    };
  }, [url]);

  if (failed) return null;

  const alignSelf =
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <View style={[styles.imageContainer, { alignSelf }]}>
      <Image
        source={{ uri: url }}
        style={[styles.inlineImage, { aspectRatio }]}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
};

export const RichHtmlRenderer: React.FC<RichHtmlRendererProps> = ({
  content,
  baseColor = '#e2e8f0',
  fontSize = 13.5,
  lineHeight = 20,
}) => {
  const blocks = parseRichContent(content);

  if (blocks.length === 0) return null;

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (block.type === 'hr') {
          return <View key={idx} style={styles.hrLine} />;
        }

        if (block.type === 'image') {
          return <RichImageBlock key={idx} url={block.url} align={block.align} />;
        }

        const headingScale =
          block.heading === 1
            ? 1.38
            : block.heading === 2
            ? 1.24
            : block.heading === 3
            ? 1.12
            : 1;
        const computedFontSize = Math.round(fontSize * headingScale);
        const computedLineHeight = Math.round(lineHeight * headingScale);

        const textAlignStyle: TextStyle = {
          textAlign: block.align,
          color: baseColor,
          fontSize: computedFontSize,
          lineHeight: computedLineHeight,
        };

        return (
          <View
            key={idx}
            style={[
              styles.textBlock,
              block.quote && styles.quoteBlock,
              block.heading ? styles.headingBlock : null,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {block.bullet ? (
                <Text style={[styles.bulletChar, { fontSize: computedFontSize, lineHeight: computedLineHeight }]}>
                  {block.bullet}
                </Text>
              ) : null}
              <Text style={[styles.paragraphText, textAlignStyle]}>
                {block.spans.map((sp, sIdx) => {
                  const spanStyle: TextStyle = {
                    fontWeight: sp.bold ? '700' : '400',
                    fontStyle: sp.italic ? 'italic' : 'normal',
                    textDecorationLine:
                      sp.underline && sp.strike
                        ? 'underline line-through'
                        : sp.underline
                        ? 'underline'
                        : sp.strike
                        ? 'line-through'
                        : 'none',
                    color: sp.color || baseColor,
                  };

                  if (sp.href) {
                    return (
                      <Text
                        key={sIdx}
                        style={spanStyle}
                        onPress={() => Linking.openURL(sp.href!).catch(() => {})}
                      >
                        {sp.text}
                      </Text>
                    );
                  }

                  return (
                    <Text key={sIdx} style={spanStyle}>
                      {sp.text}
                    </Text>
                  );
                })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
  },
  textBlock: {
    width: '100%',
  },
  headingBlock: {
    marginTop: 4,
    marginBottom: 2,
  },
  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    paddingLeft: 10,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 4,
  },
  paragraphText: {
    flex: 1,
    flexWrap: 'wrap',
  },
  bulletChar: {
    color: colors.lime,
    fontWeight: '700',
    marginRight: 7,
  },
  hrLine: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 6,
  },
  imageContainer: {
    width: '100%',
    maxWidth: '100%',
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inlineImage: {
    width: '100%',
    maxHeight: 340,
    borderRadius: 12,
  },
});

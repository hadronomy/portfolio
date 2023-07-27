// configlayer.config.mjs
import { defineDocumentType, makeSource } from "contentlayer/source-files";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
var computedFields = {
  slug: {
    type: "string",
    resolve(doc) {
      return `/${doc._raw.flattenedPath}`;
    }
  },
  slugAsParams: {
    type: "string",
    resolve(doc) {
      return doc._raw.flattenedPath.split("/").slice(1).join("/");
    }
  }
};
var Doc = defineDocumentType(() => ({
  name: "Doc",
  filePathPattern: "blog/**/*.mdx",
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true
    },
    description: {
      type: "string"
    },
    published: {
      type: "boolean",
      default: false
    }
  },
  computedFields
}));
var prettyCodeOptions = {
  theme: "github-dark",
  onVisitLine(node) {
    if (node.children.length === 0) {
      node.children = [{ type: "text", value: " " }];
    }
  },
  onVisitHighlightedLine(node) {
    node.properties.className?.push("line--highlighted");
  }
};
var configlayer_config_default = makeSource({
  contentDirPath: "src/content",
  documentTypes: [Doc],
  mdx: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypePrettyCode, prettyCodeOptions],
      [
        rehypeAutolinkHeadings,
        {
          properties: {
            className: ["subheading-anchor"],
            ariaLabel: "Link to sections"
          }
        }
      ]
    ]
  }
});
export {
  Doc,
  configlayer_config_default as default
};
//# sourceMappingURL=compiled-contentlayer-config-HCHMQQ3M.mjs.map

// Messages with markup ("We sent a code to {#address}{email}{/address}")
// render through this, so a sentence keeps its own word order around the
// node it wraps. It is a pure function of its props, so the PDF renderer
// and the emails use it as well as the pages.
export { ParaglideMessage as Message } from '@inlang/paraglide-js-react';

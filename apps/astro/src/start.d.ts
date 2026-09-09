declare module 'virtual:portfolio/start' {
  const start: { fetch(request: Request): Response | Promise<Response> };
  export default start;
}

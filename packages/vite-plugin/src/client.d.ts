declare module "*.tzr" {
  const scenario: import("@tsuzuru/core").CompiledTzrDocument;
  export default scenario;
}

declare module "*.tzr?tsuzuru" {
  const scenario: import("@tsuzuru/core").CompiledTzrDocument;
  export default scenario;
}

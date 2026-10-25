export interface PineconeRerankerOptions {
  apiKey: string;
  model: string;
  /** Test hook: points the SDK at a fake Pinecone API. */
  controllerHostUrl?: string;
}

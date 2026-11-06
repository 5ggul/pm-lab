export interface GameThumbnail {
  universeId: number;
  imageUrl: string | null;
  state: string;
}

type ApiThumb = {
  targetId: number;
  state: string;
  imageUrl: string | null;
};

export class RobloxThumbnailProvider {
  readonly endpoint = "https://thumbnails.roblox.com/v1/games/icons";

  async getGameIcons(universeIds: number[]): Promise<GameThumbnail[]> {
    if (!universeIds.length) return [];
    const url =
      `${this.endpoint}?universeIds=${universeIds.join(",")}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Oreun-R1-Preview/0.1",
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      throw new Error(`Roblox Thumbnail API ${response.status}`);
    }
    const payload = (await response.json()) as { data?: ApiThumb[] };
    return (payload.data ?? [])
      .filter((item) => item.targetId > 0)
      .map((item) => ({
        universeId: item.targetId,
        imageUrl: item.state === "Completed" ? item.imageUrl : null,
        state: item.state,
      }));
  }
}

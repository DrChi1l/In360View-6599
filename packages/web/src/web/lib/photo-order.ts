import type { LightboxPhoto } from "../components/photo-lightbox";

/**
 * Photograph ordering, shared by every viewer in the app.
 *
 * A report reads room by room, and inside a room the general room shots come
 * first and then each item — the front door, the flooring, the windows — in
 * the order the schedule lists them. The stored `sortOrder` only sequences
 * photos *within* one scope, so a flat query comes back interleaved. This
 * rebuilds the document order so sliding through photographs matches the way
 * the report and the PDF read.
 */

export type OrderablePhoto = {
  id: string;
  roomId?: string | null;
  itemId?: string | null;
  caption?: string | null;
  sortOrder?: number | null;
  thumbUrl: string;
  fullUrl?: string;
};

export type OrderableRoom = {
  id: string;
  name: string;
  items?: { id: string; name: string }[];
};

export type FrontPhoto = {
  id: string;
  caption?: string | null;
  thumbUrl: string;
  fullUrl?: string;
};

function bySortOrder(a: OrderablePhoto, b: OrderablePhoto) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

function toLightbox(photo: OrderablePhoto, context: string | null): LightboxPhoto {
  return {
    id: photo.id,
    caption: photo.caption ?? null,
    thumbUrl: photo.thumbUrl,
    fullUrl: photo.fullUrl,
    context,
  };
}

export function orderReportPhotos({
  frontPhoto,
  rooms,
  photos,
}: {
  frontPhoto?: FrontPhoto | null;
  rooms: OrderableRoom[];
  photos: OrderablePhoto[];
}): LightboxPhoto[] {
  const ordered: LightboxPhoto[] = [];
  const used = new Set<string>();

  // The front elevation belongs to the property rather than the inspection,
  // so it leads the sequence exactly as it heads the report cover.
  if (frontPhoto) {
    ordered.push(toLightbox(frontPhoto, "Front elevation"));
    used.add(frontPhoto.id);
  }

  for (const room of rooms) {
    const roomPhotos = photos.filter((p) => p.roomId === room.id);

    for (const photo of roomPhotos.filter((p) => !p.itemId).sort(bySortOrder)) {
      ordered.push(toLightbox(photo, room.name));
      used.add(photo.id);
    }

    for (const item of room.items ?? []) {
      for (const photo of roomPhotos.filter((p) => p.itemId === item.id).sort(bySortOrder)) {
        ordered.push(toLightbox(photo, `${room.name} · ${item.name}`));
        used.add(photo.id);
      }
    }

    // A photo whose item was since removed still belongs to its room.
    for (const photo of roomPhotos.filter((p) => !used.has(p.id)).sort(bySortOrder)) {
      ordered.push(toLightbox(photo, room.name));
      used.add(photo.id);
    }
  }

  // Anything unattached trails the rooms, the way the PDF prints it.
  for (const photo of photos.filter((p) => !used.has(p.id)).sort(bySortOrder)) {
    ordered.push(toLightbox(photo, "General"));
    used.add(photo.id);
  }

  return ordered;
}

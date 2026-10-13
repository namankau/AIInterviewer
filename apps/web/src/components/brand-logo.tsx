import Image from "next/image";

/** The supplied raster assets share one wordmark and remain legible on both themes. */
export function BrandWordmark({ inverse = false }: { inverse?: boolean }) {
  if (inverse) {
    return (
      <Image
        src="/brand/wordmark-dark.png"
        alt="Untiered.tech"
        width={531}
        height={82}
        className="h-auto w-[9.5rem] sm:w-[10.5rem]"
      />
    );
  }

  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet="/brand/wordmark-dark.png" />
      <Image
        src="/brand/wordmark-light.png"
        alt="Untiered.tech"
        width={531}
        height={82}
        className="h-auto w-[9.5rem] sm:w-[10.5rem]"
      />
    </picture>
  );
}

export function BrandMark() {
  return (
    <Image
      src="/brand/mark.png"
      alt="Untiered.tech"
      width={69}
      height={82}
      className="h-8 w-auto"
    />
  );
}

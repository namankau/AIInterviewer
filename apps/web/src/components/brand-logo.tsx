import Image from "next/image";

/** The supplied raster wordmarks have light and dark surface variants. */
export function BrandWordmark({ inverse = false }: { inverse?: boolean }) {
  if (inverse) {
    return (
      <Image
        src="/brand/wordmark-dark.png"
        alt="Untiered"
        width={378}
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
        alt="Untiered"
        width={378}
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
      alt="Untiered"
      width={69}
      height={82}
      className="h-8 w-auto"
    />
  );
}

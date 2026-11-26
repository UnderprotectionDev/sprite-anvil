import { Button } from "@sprite-anvil/ui/components/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { UseEmblaCarouselType } from "embla-carousel-react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import * as React from "react";

// Paper · 01 Components · 05 Data + media · Carousel. Embla steps through frames
// with 16px gaps; previous and next are 36px Utility buttons 16px outside the
// track, and a quiet dot row marks the current snap (active dot widens to 20px).
type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

interface CarouselProps {
	opts?: CarouselOptions;
	orientation?: "horizontal" | "vertical";
	plugins?: CarouselPlugin;
	setApi?: (api: CarouselApi) => void;
}

type CarouselContextProps = {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	api: ReturnType<typeof useEmblaCarousel>[1];
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
	const context = React.useContext(CarouselContext);

	if (!context) {
		throw new Error("useCarousel must be used within a <Carousel />");
	}

	return context;
}

function Carousel({
	orientation = "horizontal",
	opts,
	setApi,
	plugins,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & CarouselProps) {
	const [carouselRef, api] = useEmblaCarousel(
		{
			...opts,
			axis: orientation === "horizontal" ? "x" : "y",
		},
		plugins
	);
	const [canScrollPrev, setCanScrollPrev] = React.useState(false);
	const [canScrollNext, setCanScrollNext] = React.useState(false);

	const onSelect = React.useCallback((selectedApi: CarouselApi) => {
		if (!selectedApi) {
			return;
		}
		setCanScrollPrev(selectedApi.canScrollPrev());
		setCanScrollNext(selectedApi.canScrollNext());
	}, []);

	const scrollPrev = React.useCallback(() => {
		api?.scrollPrev();
	}, [api]);

	const scrollNext = React.useCallback(() => {
		api?.scrollNext();
	}, [api]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				scrollPrev();
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				scrollNext();
			}
		},
		[scrollPrev, scrollNext]
	);

	React.useEffect(() => {
		if (!(api && setApi)) {
			return;
		}
		setApi(api);
	}, [api, setApi]);

	React.useEffect(() => {
		if (!api) {
			return;
		}
		onSelect(api);
		api.on("reInit", onSelect);
		api.on("select", onSelect);

		return () => {
			api?.off("select", onSelect);
		};
	}, [api, onSelect]);

	return (
		<CarouselContext.Provider
			value={{
				carouselRef,
				api,
				opts,
				orientation:
					orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
				scrollPrev,
				scrollNext,
				canScrollPrev,
				canScrollNext,
			}}
		>
			<div
				aria-roledescription="carousel"
				className={cn("relative", className)}
				data-slot="carousel"
				onKeyDownCapture={handleKeyDown}
				role="region"
				{...props}
			>
				{children}
			</div>
		</CarouselContext.Provider>
	);
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
	const { carouselRef, orientation } = useCarousel();

	return (
		<div
			className="overflow-hidden"
			data-slot="carousel-content"
			ref={carouselRef}
		>
			<div
				className={cn(
					"flex",
					orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
					className
				)}
				{...props}
			/>
		</div>
	);
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
	const { orientation } = useCarousel();

	return (
		<div
			aria-roledescription="slide"
			className={cn(
				"min-w-0 shrink-0 grow-0 basis-full",
				orientation === "horizontal" ? "pl-4" : "pt-4",
				className
			)}
			data-slot="carousel-item"
			role="group"
			{...props}
		/>
	);
}

function CarouselPrevious({
	className,
	variant = "outline",
	size = "icon-sm",
	...props
}: React.ComponentProps<typeof Button>) {
	const { orientation, scrollPrev, canScrollPrev } = useCarousel();

	return (
		<Button
			className={cn(
				"absolute touch-manipulation",
				orientation === "horizontal"
					? "inset-y-0 -left-13 my-auto"
					: "-top-13 left-1/2 -translate-x-1/2 rotate-90",
				className
			)}
			data-slot="carousel-previous"
			disabled={!canScrollPrev}
			onClick={scrollPrev}
			size={size}
			variant={variant}
			{...props}
		>
			<ArrowLeftIcon className="size-4" />
			<span className="sr-only">Previous slide</span>
		</Button>
	);
}

function CarouselNext({
	className,
	variant = "outline",
	size = "icon-sm",
	...props
}: React.ComponentProps<typeof Button>) {
	const { orientation, scrollNext, canScrollNext } = useCarousel();

	return (
		<Button
			className={cn(
				"absolute touch-manipulation",
				orientation === "horizontal"
					? "inset-y-0 -right-13 my-auto"
					: "-bottom-13 left-1/2 -translate-x-1/2 rotate-90",
				className
			)}
			data-slot="carousel-next"
			disabled={!canScrollNext}
			onClick={scrollNext}
			size={size}
			variant={variant}
			{...props}
		>
			<ArrowRightIcon className="size-4" />
			<span className="sr-only">Next slide</span>
		</Button>
	);
}

function CarouselDots({ className, ...props }: React.ComponentProps<"div">) {
	const { api } = useCarousel();
	const [snapCount, setSnapCount] = React.useState(0);
	const [selectedSnap, setSelectedSnap] = React.useState(0);

	React.useEffect(() => {
		if (!api) {
			return;
		}
		const sync = () => {
			setSnapCount(api.scrollSnapList().length);
			setSelectedSnap(api.selectedScrollSnap());
		};
		sync();
		api.on("reInit", sync);
		api.on("select", sync);
		return () => {
			api.off("reInit", sync);
			api.off("select", sync);
		};
	}, [api]);

	return (
		<div
			aria-hidden="true"
			className={cn("flex items-center justify-center gap-2", className)}
			data-slot="carousel-dots"
			{...props}
		>
			{Array.from({ length: snapCount }, (_, snap) => (
				<span
					className="bg-workbench-border-strong data-[active=true]:bg-workbench-text h-2 w-2 shrink-0 rounded-full transition-[width,background-color] duration-120 data-[active=true]:w-5"
					data-active={snap === selectedSnap}
					// biome-ignore lint/suspicious/noArrayIndexKey: Snap positions are a fixed, ordered list without other identity.
					key={snap}
				/>
			))}
		</div>
	);
}

export {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselDots,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	useCarousel,
};

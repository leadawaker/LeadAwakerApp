import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  name: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePosition?: string;
  imageScale?: number;
  logo?: React.ReactNode;
}

interface TestimonialCarouselProps {
  sectionLabel?: string;
  testimonials: Testimonial[];
}

export function TestimonialCarousel({ sectionLabel, testimonials }: TestimonialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
    );
  };

  const current = testimonials[currentIndex];

  return (
    <div className="w-full py-12">
      {sectionLabel && (
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {sectionLabel}
          </h2>
        </div>
      )}

      <div className="relative max-w-4xl mx-auto">
        {/* Testimonial Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Image */}
            <div
              className="relative h-64 md:h-80 overflow-hidden bg-gray-200 dark:bg-slate-800"
              style={{
                backgroundImage: `url(${current.imageUrl})`,
                backgroundPosition: current.imagePosition || "center",
                backgroundSize: `${(current.imageScale || 1) * 100}%`,
                backgroundRepeat: "no-repeat",
              }}
            />

            {/* Content */}
            <div className="p-8 md:p-10 flex flex-col justify-between">
              <div>
                {current.logo && (
                  <div className="mb-6">
                    {current.logo}
                  </div>
                )}
                <p className="text-lg md:text-xl text-foreground/90 mb-6 leading-relaxed">
                  "{current.description}"
                </p>
              </div>

              <div>
                <p className="font-semibold text-foreground text-lg">
                  {current.name}
                </p>
                <p className="text-muted-foreground text-sm">
                  {current.title}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Dots */}
        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-8 bg-primary"
                    : "w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Navigation Buttons */}
        {testimonials.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 md:-translate-x-16"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 md:translate-x-16"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

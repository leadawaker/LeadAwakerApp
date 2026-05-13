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
  return (
    <div className="w-full py-12">
      {sectionLabel && (
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {sectionLabel}
          </h2>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <div key={index} className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-lg">
            <div className="h-64 md:h-80 overflow-hidden bg-gray-200 dark:bg-slate-800" style={{
              backgroundImage: `url(${testimonial.imageUrl})`,
              backgroundPosition: testimonial.imagePosition || "center",
              backgroundSize: `${(testimonial.imageScale || 1) * 100}%`,
              backgroundRepeat: "no-repeat",
            }} />

            <div className="p-8 md:p-10 flex flex-col justify-between min-h-[240px]">
              <div>
                {testimonial.logo && (
                  <div className="mb-6">
                    {testimonial.logo}
                  </div>
                )}
                <p className="text-lg text-foreground/90 mb-6 leading-relaxed">
                  "{testimonial.description}"
                </p>
              </div>

              <div>
                <p className="font-semibold text-foreground text-lg">
                  {testimonial.name}
                </p>
                <p className="text-muted-foreground text-sm">
                  {testimonial.title}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

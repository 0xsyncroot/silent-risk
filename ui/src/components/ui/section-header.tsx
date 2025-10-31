interface SectionHeaderProps {
  tag: string;
  title: string;
  description: string;
  tagColor?: string;
}

export function SectionHeader({ 
  tag, 
  title, 
  description, 
  tagColor = "bg-[#eab308]" 
}: SectionHeaderProps) {
  return (
    <div className="text-center mb-16">
      <div className={`inline-block px-4 py-2 ${tagColor} text-white text-sm font-bold rounded-full mb-4`}>
        {tag}
      </div>
      <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black">
        {title}
      </h2>
      <p className="text-xl text-[#2c2c2c] max-w-3xl mx-auto">
        {description}
      </p>
    </div>
  );
}

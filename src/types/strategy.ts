export type Civilization = { id: string; name: string };

export type BuildOrder = {
    id: string;
    name: string;
    source_pdf_page: number;
    introduction_text: string;
    recommended_civ_names: string[];
    is_generic: boolean;
    steps: string[];
    whats_next_text: string;
    video_url: string;
};

export type StrategyData = {
    civilizations: Civilization[];
    buildOrders: BuildOrder[];
};

import React from "react";
import { render } from "@testing-library/react";
import RootLayout, { metadata } from "../app/layout";

describe("RootLayout", () => {
    it("renders children correctly", () => {
        const { getByText } = render(
            <RootLayout>
                <div>Test Child</div>
            </RootLayout>
        );
        expect(getByText("Test Child")).toBeInTheDocument();
    });

    it("sets html lang attribute to en", () => {
        const { container } = render(
            <RootLayout>
                <div />
            </RootLayout>
        );
        const html = container.querySelector("html");
        expect(html).toHaveAttribute("lang", "en");
    });

    it("applies font variables and antialiased class to body", () => {
        const { container } = render(
            <RootLayout>
                <div />
            </RootLayout>
        );
        const body = container.querySelector("body");
        expect(body?.className).toContain("--font-geist-sans");
        expect(body?.className).toContain("--font-geist-mono");
        expect(body?.className).toContain("antialiased");
    });
});

describe("metadata", () => {
    it("has correct title and description", () => {
        expect(metadata.title).toBe("Love On Dev");
        expect(metadata.description).toBe("Creating better software");
    });
});

// We recommend installing an extension to run jest tests.